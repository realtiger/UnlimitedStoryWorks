//! 进程启动入口：clap CLI → 配置加载 → logging → AnyPool（sqlite/postgres）→ 路由 → serve。

use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use clap::Parser;
use once_cell::sync::OnceCell;
use sqlx::AnyPool;

use crate::common::logging as log_mod;

mod common;
mod config;
mod db;
mod middleware;
mod routes;
mod services;

/// 进程级 DB Pool 单例。
static DB_POOL: OnceCell<AnyPool> = OnceCell::new();

pub fn db() -> &'static AnyPool {
    DB_POOL
        .get()
        .expect("DB 未初始化：main.rs 必须先调用 db::init() 并 set 进 DB_POOL")
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

#[derive(Debug, Parser, Clone)]
#[command(
    name = "unlimitedstoryworks",
    version,
    about = "Unlimited Story Works / 无限绘卷 —— 后端服务",
    long_about = None
)]
pub struct Cli {
    /// 工作目录：数据库和配置文件的根目录。
    /// `--config` 为相对路径时，会拼接此目录使用。
    #[arg(
        long,
        short = 'w',
        env = "USW_WORKSPACE",
        default_value = "./usw",
        value_name = "DIR",
        help = "工作目录，用于存储数据库和配置文件"
    )]
    pub workspace: String,

    /// 配置文件路径：绝对路径直接使用；相对路径拼接 workspace；不传时默认 {workspace}/config.yaml。
    #[arg(
        long,
        short = 'c',
        env = "USW_CONFIG",
        value_name = "FILE",
        help = "配置文件路径，不传时默认使用工作目录下的 config.yaml"
    )]
    pub config: Option<PathBuf>,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let workspace_dir = config::AppConfig::workspace_root(&cli.workspace);

    // 保证 workspace 目录存在
    if let Err(e) = std::fs::create_dir_all(&workspace_dir) {
        eprintln!("[FATAL] 创建 workspace 目录失败 ({}): {e:#}", workspace_dir.display());
        std::process::exit(1);
    }

    // 加载配置（文件不存在时用默认值兜底）
    let config_arg = cli.config.as_deref().and_then(|p| p.to_str());
    let (cfg, config_path) = match config::AppConfig::load(&cli.workspace, config_arg) {
        Ok(pair) => pair,
        Err(e) => {
            let mut fallback = config::AppConfig::default();
            if let Err(fe) = fallback.finalize() {
                eprintln!("[FATAL] 默认配置 finalize 失败: {fe:#}");
                std::process::exit(1);
            }
            eprintln!(
                "[WARN] 加载配置失败（用默认值兜底）: {e:#}。\n\
                 如要自定义，请在 {}/config.yaml 放配置文件。",
                workspace_dir.display()
            );
            let fallback_path = workspace_dir.join("config.yaml");
            (fallback, fallback_path)
        }
    };

    // 初始化 logging
    if let Err(e) = log_mod::init(&cfg.logging()) {
        eprintln!("[WARN] 初始化 logging 失败（跳过）: {e:#}");
    }
    tracing::info!(
        target: "usw::boot",
        workspace = %workspace_dir.display(),
        config_path = %config_path.display(),
        "启动 axum 服务"
    );

    // 安装 config 单例
    if let Err(_old) = config::install(cfg.clone()) {
        tracing::warn!(target: "usw::boot", "config::install 被重复调用（忽略）");
    }

    // 解析监听地址
    let server = cfg.server();
    let host = server.host.as_deref().unwrap_or("127.0.0.1");
    let port = server.port.unwrap_or(5000);
    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .unwrap_or_else(|_| SocketAddr::from(([127, 0, 0, 1], 5000)));

    // 初始化 DB
    let db_cfg = cfg.database();

    let pool = match db::init(&cfg, &workspace_dir).await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(target: "usw::boot", driver = %db_cfg.driver, error = %e, "DB 初始化失败");
            std::process::exit(1);
        }
    };
    if let Err(_old) = DB_POOL.set(pool) {
        tracing::warn!(target: "usw::boot", "DB_POOL 重复 set（忽略）");
    }

    // 构建路由 + 启动
    let app = routes::build_router(&cfg);
    let grace_secs = server.graceful_shutdown_secs;

    println!("▶ workspace: {}", workspace_dir.display());
    println!("▶ config  : {}", config_path.display());
    println!("▶ db      : driver={}, name={}", db_cfg.driver, db_cfg.name);
    println!("▶ listen  : http://{addr}");
    println!("▶ api     : GET /health, GET/POST/PUT/PATCH/DELETE /api/v1/projects");
    println!("▶ swagger : /swagger/");

    if let Err(e) = axum::serve(listener(addr).await, app)
        .with_graceful_shutdown(shutdown_signal(grace_secs))
        .await
    {
        tracing::error!(target: "usw::boot", error = %e, "axum serve 异常退出");
        std::process::exit(1);
    }
    tracing::info!(target: "usw::boot", "服务已正常退出");
    println!("👋 服务已正常退出");
}

async fn listener(addr: SocketAddr) -> tokio::net::TcpListener {
    match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!(target: "usw::boot", %addr, error = %e, "bind 失败（占用？权限？）");
            std::process::exit(1);
        }
    }
}

// ---------------------------------------------------------------------------
// 信号：Ctrl+C / SIGTERM
// ---------------------------------------------------------------------------

async fn shutdown_signal(grace_secs: u64) {
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::warn!(target: "usw::signal", error = %e, "安装 Ctrl+C handler 失败");
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let term = async {
        use tokio::signal::unix::{signal, SignalKind};
        let mut s = match signal(SignalKind::terminate()) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(target: "usw::signal", error = %e, "安装 SIGTERM handler 失败");
                std::future::pending::<()>().await;
                return;
            }
        };
        s.recv().await;
    };

    #[cfg(not(unix))]
    let term = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!(target: "usw::signal", grace_secs, "SIGINT 收到 → 开始优雅关机");
        }
        _ = term => {
            tracing::info!(target: "usw::signal", grace_secs, "SIGTERM 收到 → 开始优雅关机");
        }
    }
    tokio::time::sleep(Duration::from_millis(50)).await;
}
