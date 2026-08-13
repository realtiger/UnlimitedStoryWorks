//! 日志初始化：console / file / both 三种输出端 × pretty / compact / json 三种格式。
//!
//! - 级别：支持 `RUST_LOG` 环境变量覆盖 `logging.level`
//! - 文件滚动：按日切分 `<prefix>.YYYY-MM-DD`
//! - 文件保留：`logging.keep_days`（缺省或 0 → 7 天），启动立即清理一次，之后每 24h 再扫
//! - 颜色：终端开 ANSI；文件强制关 ANSI（方便 grep / 日志采集）
//! - non-blocking：`tracing_appender::non_blocking` 独立写盘线程，WorkerGuard 存 static 保证 flush

use std::{sync::OnceLock, time::Duration};

use tracing::Level;
use tracing_appender::{
    non_blocking::{NonBlocking, WorkerGuard},
    rolling::daily,
};
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::LoggingConfig;

const DEFAULT_KEEP_DAYS: i64 = 7;

/// 写盘线程的 WorkerGuard，进程退出时 static 释放自动 drop 保证 flush。
static _APPENDER_GUARD: OnceLock<WorkerGuard> = OnceLock::new();

// tracing-subscriber 的 pretty/compact/json 返回不同类型，无法用 match 返回 layer。
// 这两个宏把 format 分支展开为具体类型，在每条手臂内完成完整的 registry().init() 调用。

macro_rules! with_console_layer {
    ($format:expr, |$layer:ident| $body:expr) => {
        match $format.as_str() {
            "compact" => { let $layer = fmt::layer().with_file(true).with_line_number(true).with_target(true).with_ansi(true).compact(); $body }
            "json"    => { let $layer = fmt::layer().with_file(true).with_line_number(true).with_target(true).with_ansi(true).json(); $body }
            _         => { let $layer = fmt::layer().with_file(true).with_line_number(true).with_target(true).with_ansi(true).pretty(); $body }
        }
    };
}

macro_rules! with_file_layer {
    ($format:expr, $writer:expr, |$layer:ident| $body:expr) => {
        match $format.as_str() {
            "compact" => { let $layer = fmt::layer().with_writer($writer).with_file(true).with_line_number(true).with_target(true).with_ansi(false).compact(); $body }
            "json"    => { let $layer = fmt::layer().with_writer($writer).with_file(true).with_line_number(true).with_target(true).with_ansi(false).json(); $body }
            _         => { let $layer = fmt::layer().with_writer($writer).with_file(true).with_line_number(true).with_target(true).with_ansi(false).pretty(); $body }
        }
    };
}

/// 初始化 tracing 全局 subscriber，同步启动日志 TTL 后台清理任务。
pub fn init(cfg: &LoggingConfig) -> anyhow::Result<()> {
    let keep_days = if cfg.keep_days > 0 { cfg.keep_days } else { DEFAULT_KEEP_DAYS };
    let filter = build_env_filter(cfg);
    let target = cfg.target.to_ascii_lowercase();
    let format = cfg.format.to_ascii_lowercase();

    // 需要文件输出时，初始化 daily appender + TTL 清理任务
    let nb = match target.as_str() {
        "file" | "both" => {
            let (nb, guard) = open_daily(cfg)?;
            spawn_cleanup_loop(cfg.file_dir.clone(), cfg.file_prefix.clone(), keep_days);
            let _ = _APPENDER_GUARD.set(guard);
            Some(nb)
        }
        "console" => None,
        other => anyhow::bail!("未知 logging.target={other:?}，合法值：console / file / both"),
    };

    match (target.as_str(), nb) {
        ("console", _) => {
            with_console_layer!(format, |layer| {
                tracing_subscriber::registry().with(filter).with(layer).init()
            });
        }
        ("file", Some(nb)) => {
            with_file_layer!(format, nb, |layer| {
                tracing_subscriber::registry().with(filter).with(layer).init()
            });
        }
        ("both", Some(nb)) => {
            with_console_layer!(format, |cl| {
                with_file_layer!(format, nb, |fl| {
                    tracing_subscriber::registry()
                        .with(filter)
                        .with(cl)
                        .with(fl)
                        .init()
                })
            });
        }
        _ => unreachable!(),
    }

    tracing::debug!(
        target: "usw::logging",
        level = cfg.level,
        target = cfg.target,
        format = cfg.format,
        keep_days,
        "logging 初始化完成"
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

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
        // 压制高频依赖库的噪音日志
        EnvFilter::new(format!(
            "{lvl},tower_http=info,hyper=info,reqwest=info,h2=info,rustls=info"
        ))
    })
}

fn open_daily(cfg: &LoggingConfig) -> anyhow::Result<(NonBlocking, WorkerGuard)> {
    std::fs::create_dir_all(&cfg.file_dir)
        .map_err(|e| anyhow::anyhow!("创建日志目录 {} 失败：{e}", cfg.file_dir))?;
    let appender = daily(&cfg.file_dir, &cfg.file_prefix);
    Ok(tracing_appender::non_blocking(appender))
}

/// 启动后台 TTL 清理任务：立即执行一次，之后每 24h 循环。
fn spawn_cleanup_loop(dir: String, prefix: String, keep_days: i64) {
    tokio::spawn(async move {
        cleanup_expired_logs(&dir, &prefix, keep_days).await;
        let mut interval = tokio::time::interval(Duration::from_secs(24 * 3600));
        interval.tick().await; // 首次 tick 立即返回，跳过
        loop {
            interval.tick().await;
            cleanup_expired_logs(&dir, &prefix, keep_days).await;
        }
    });
}

/// 扫描日志目录，删除超过 keep_days 的 `<prefix>.YYYY-MM-DD` 文件。
async fn cleanup_expired_logs(dir: &str, prefix: &str, keep_days: i64) {
    use std::path::Path;

    let read_dir = match std::fs::read_dir(Path::new(dir)) {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(target: "usw::logging::ttl", dir, %e, "读取日志目录失败，跳过清理");
            return;
        }
    };

    let cutoff = match chrono::Local::now().checked_sub_signed(chrono::Duration::days(keep_days)) {
        Some(d) => d.date_naive(),
        None => return,
    };

    let prefix_dot = format!("{prefix}.");
    let mut deleted: usize = 0;
    let mut errors: usize = 0;

    for entry in read_dir.flatten() {
        if !entry.file_type().is_ok_and(|t| t.is_file()) {
            continue;
        }
        let fname = match entry.file_name().into_string() {
            Ok(s) => s,
            Err(_) => continue,
        };
        let Some(date_str) = fname.strip_prefix(&prefix_dot) else {
            continue;
        };
        let Ok(file_date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") else {
            continue;
        };
        if file_date >= cutoff {
            continue;
        }

        let path = entry.path();
        match std::fs::remove_file(&path) {
            Ok(()) => deleted += 1,
            Err(e) => {
                errors += 1;
                tracing::warn!(target: "usw::logging::ttl", path = %path.display(), %e, "清理过期日志失败");
            }
        }
    }

    if deleted > 0 || errors > 0 {
        tracing::info!(
            target: "usw::logging::ttl",
            dir, keep_days, deleted, errors,
            "日志 TTL 清理执行完毕"
        );
    }
}
