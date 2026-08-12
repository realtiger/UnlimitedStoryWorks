//! 日志初始化模块。
//!
//! ## 对外能力
//!
//! - 输出端（`logging.target`）：`console` / `file` / `both`
//! - 格式（`logging.format`）：`pretty` / `compact` / `json`
//! - 级别：支持 `RUST_LOG` 环境变量覆盖配置文件里的 `logging.level`
//! - 文件滚动：按日切分 `<prefix>.YYYY-MM-DD`
//! - 文件保留：`logging.keep_days`（缺省或 0 → 默认 7 天），启动立即清理一次，之后每 24h 再扫一次
//! - 颜色：终端打开 ANSI；文件强制关闭 ANSI（方便 grep / ELK / 正则采集）
//! - non-blocking：通过 `tracing_appender::non_blocking` 独立写盘线程 + WorkerGuard
//!   存进 `static OnceLock`，保证直到进程退出都不会 flush 丢日志。

use std::{sync::OnceLock, time::Duration};

use tracing::Level;
use tracing_appender::{
    non_blocking::{NonBlocking, WorkerGuard},
    rolling::daily,
};
use tracing_subscriber::{
    EnvFilter,
    fmt,
    layer::SubscriberExt,
    util::SubscriberInitExt,
};

use crate::config::LoggingConfig;

/// 日志文件保留天数兜底：`keep_days` 缺失或写 0 时用。
const DEFAULT_KEEP_DAYS_FALLBACK: i64 = 7;

/// 写盘线程的 WorkerGuard。只有进程退出时 static 释放才会 drop，保证 flush。
static _APPENDER_GUARD: OnceLock<WorkerGuard> = OnceLock::new();

/// 初始化 tracing 全局 subscriber，同步启动日志 TTL 后台任务。
pub fn init(cfg: &LoggingConfig) -> anyhow::Result<()> {
    let keep_days = normalize_keep_days(cfg.keep_days);
    let filter = build_env_filter(cfg);
    let target_mode = cfg.target.to_ascii_lowercase();
    let format = cfg.format.to_ascii_lowercase();

    match target_mode.as_str() {
        "console" => init_console(filter, &format),
        "file" => {
            let (nb, guard) = open_daily(cfg)?;
            spawn_cleanup_loop(cfg.file_dir.clone(), cfg.file_prefix.clone(), keep_days);
            init_file(filter, &format, nb);
            let _ = _APPENDER_GUARD.set(guard);
        }
        "both" => {
            let (nb, guard) = open_daily(cfg)?;
            spawn_cleanup_loop(cfg.file_dir.clone(), cfg.file_prefix.clone(), keep_days);
            init_both(filter, &format, nb);
            let _ = _APPENDER_GUARD.set(guard);
        }
        other => anyhow::bail!(
            "未知 logging.target={other:?}，合法值：console / file / both"
        ),
    }

    tracing::debug!(
        target: "usw::logging",
        level = cfg.level,
        target_mode = cfg.target,
        format = cfg.format,
        keep_days,
        "logging 初始化完成"
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// 三种 target × 三种 format：每段分支写完整的 registry()，避免 Layer 泛型不兼容
// ---------------------------------------------------------------------------

fn init_console(filter: EnvFilter, fmt: &str) {
    match fmt {
        "pretty" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).pretty())
            .init(),
        "compact" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).compact())
            .init(),
        "json" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).json())
            .init(),
        _ => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).pretty())
            .init(),
    }
}

fn init_file(filter: EnvFilter, fmt: &str, w: NonBlocking) {
    match fmt {
        "pretty" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_writer(w)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).pretty())
            .init(),
        "compact" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_writer(w)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).compact())
            .init(),
        "json" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_writer(w)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).json())
            .init(),
        _ => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_writer(w)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).pretty())
            .init(),
    }
}

fn init_both(filter: EnvFilter, fmt: &str, fw: NonBlocking) {
    match fmt {
        "pretty" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).pretty())
            .with(fmt::layer()
                .with_writer(fw)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).pretty())
            .init(),
        "compact" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).compact())
            .with(fmt::layer()
                .with_writer(fw)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).compact())
            .init(),
        "json" => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).json())
            .with(fmt::layer()
                .with_writer(fw)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).json())
            .init(),
        _ => tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer()
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(true).pretty())
            .with(fmt::layer()
                .with_writer(fw)
                .with_file(true).with_line_number(true).with_target(true)
                .with_ansi(false).pretty())
            .init(),
    }
}

// ---------------------------------------------------------------------------
// 工具：按日滚动 writer、EnvFilter 构造、过期清理（启动一次 + 24h 循环）
// ---------------------------------------------------------------------------

fn normalize_keep_days(raw: i64) -> i64 {
    if raw > 0 { raw } else { DEFAULT_KEEP_DAYS_FALLBACK }
}

fn build_env_filter(cfg: &LoggingConfig) -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        let lvl = match cfg.level.to_ascii_lowercase().as_str() {
            "trace" => Level::TRACE,
            "debug" => Level::DEBUG,
            "info"  => Level::INFO,
            "warn"  => Level::WARN,
            "error" => Level::ERROR,
            other => {
                eprintln!("[logging] 未知 level={other:?}，回退 INFO");
                Level::INFO
            }
        };
        EnvFilter::new(format!(
            "{},tower_http=info,hyper=info,reqwest=info,h2=info,rustls=info",
            lvl
        ))
    })
}

fn open_daily(cfg: &LoggingConfig) -> anyhow::Result<(NonBlocking, WorkerGuard)> {
    std::fs::create_dir_all(&cfg.file_dir)
        .map_err(|e| anyhow::anyhow!("创建日志目录 {} 失败：{e}", cfg.file_dir))?;
    let appender = daily(&cfg.file_dir, &cfg.file_prefix);
    Ok(tracing_appender::non_blocking(appender))
}

fn spawn_cleanup_loop(dir: String, prefix: String, keep_days: i64) {
    tokio::spawn(async move {
        cleanup_expired_logs(&dir, &prefix, keep_days).await;
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 3600));
        interval.tick().await;
        loop {
            interval.tick().await;
            cleanup_expired_logs(&dir, &prefix, keep_days).await;
        }
    });
}

async fn cleanup_expired_logs(dir: &str, prefix: &str, keep_days: i64) {
    use std::path::{Path, PathBuf};
    let dir_path = Path::new(dir);
    let read_dir = match std::fs::read_dir(dir_path) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(target: "usw::logging::ttl", dir, %e, "读取日志目录失败，跳过过期清理");
            return;
        }
    };

    let cutoff = match chrono::Local::now().checked_sub_signed(
        chrono::Duration::days(keep_days),
    ) {
        Some(d) => d.date_naive(),
        None => return,
    };

    let prefix_dot = format!("{prefix}.");
    let mut deleted: usize = 0;
    let mut errors: usize = 0;

    for entry in read_dir.flatten() {
        let ftype = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if !ftype.is_file() { continue; }

        let fname = match entry.file_name().into_string() {
            Ok(s) => s,
            Err(_) => continue,
        };
        let Some(date_str) = fname.strip_prefix(&prefix_dot) else {
            continue;
        };
        let file_date = match chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        if file_date >= cutoff {
            continue;
        }

        let path: PathBuf = entry.path();
        match std::fs::remove_file(&path) {
            Ok(()) => deleted += 1,
            Err(e) => {
                errors += 1;
                tracing::warn!(
                    target: "usw::logging::ttl",
                    path = %path.display(),
                    %e,
                    "清理过期日志失败"
                );
            }
        }
    }

    if deleted > 0 || errors > 0 {
        tracing::info!(
            target: "usw::logging::ttl",
            dir,
            keep_days,
            deleted,
            errors,
            "日志 TTL 清理执行完毕"
        );
    }
}
