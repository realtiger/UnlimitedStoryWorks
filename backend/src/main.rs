use std::time::Duration;

use crate::common::logging as log_mod;

mod config;
mod common;
mod routes;
mod services;

#[tokio::main]
async fn main() {
    // ---- 1. CLI args + config ----
    let config_path = parse_config_path();
    let cfg = match config::AppConfig::load(&config_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[FATAL] 加载配置失败 ({config_path}): {e:#}");
            std::process::exit(1);
        }
    };
    let listen = match cfg.socket_addr() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("[FATAL] server.host/port 无效: {e:#}");
            std::process::exit(1);
        }
    };

    // ---- 2. 初始化 logging ----
    if let Err(e) = log_mod::init(&cfg.logging) {
        eprintln!("[WARN] 初始化 logging 失败（跳过）: {e:#}");
    }
    // 安装好 logging 后，后续所有日志走 tracing:: 宏
    tracing::info!(
        target: "usw::boot",
        site = %cfg.site_info.name,
        version = %cfg.site_info.version,
        environment = %cfg.site_info.environment,
        listen = %listen,
        logging_target = %cfg.logging.target,
        logging_level = %cfg.logging.level,
        "启动 axum 服务"
    );

    // ---- 3. 安装成进程单例 ----
    if let Err(_old) = config::install(cfg.clone()) {
        tracing::warn!(
            target: "usw::boot",
            "config::install 被重复调用（忽略，沿用首次安装的值）"
        );
    }

    // ---- 4. 构建路由表（交给 routes 模块统一组装，main 不关心细节）----
    let app = routes::build_router();
    tracing::debug!(target: "usw::boot", "路由表构造完成");

    // ---- 5. 启动 ----
    let listener = match tokio::net::TcpListener::bind(listen).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!(
                target: "usw::boot",
                %listen,
                error = %e,
                "bind 失败（占用？权限？）"
            );
            std::process::exit(1);
        }
    };

    println!("▶ site    : {} v{} ({})", cfg.site_info.name, cfg.site_info.version, cfg.site_info.environment);
    println!("▶ listen  : http://{listen}");
    println!("▶ logging : target={} level={}", cfg.logging.target, cfg.logging.level);
    println!("▶ demo    : GET /api/v1/config, /api/v1/error-demo?kind=invalid_param");

    let grace_secs = cfg.server.graceful_shutdown_secs;
    if let Err(e) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(grace_secs))
        .await
    {
        tracing::error!(target: "usw::boot", error = %e, "axum serve 异常退出");
        std::process::exit(1);
    }
    tracing::info!(target: "usw::boot", "服务已正常退出");
    println!("👋 服务已正常退出");
}

/// 解析 `--config <path>`，缺省返回 `./config.yaml`
fn parse_config_path() -> String {
    let args: Vec<String> = std::env::args().collect();
    let i = args.iter().position(|s| s == "--config");
    match i {
        Some(i) if i + 1 < args.len() => args[i + 1].clone(),
        _ => "./config.yaml".into(),
    }
}

/// Ctrl+C / SIGTERM 双信号：统一给上层 axxum::serve::with_graceful_shutdown 用
async fn shutdown_signal(grace_secs: u64) {
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::warn!(target: "usw::signal", error = %e, "安装 Ctrl+C handler 失败");
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let term = async {
        let mut s = match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(
                    target: "usw::signal",
                    error = %e,
                    "安装 SIGTERM handler 失败，后续只响应 Ctrl+C"
                );
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

