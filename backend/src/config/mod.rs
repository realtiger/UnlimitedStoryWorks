//! 配置模块：model 放结构定义 + 默认值，mod 放加载 + 单例管理。

pub mod model;

pub use model::{AppConfig, LoggingConfig};

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use once_cell::sync::OnceCell;

static APP_CONFIG: OnceCell<Arc<AppConfig>> = OnceCell::new();

/// 首次启动时把配置安装为进程内只读单例。
pub fn install(cfg: AppConfig) -> Result<(), AppConfig> {
    APP_CONFIG
        .set(Arc::new(cfg))
        .map_err(|arc_cfg| match Arc::try_unwrap(arc_cfg) {
            Ok(owned) => owned,
            Err(arc) => (*arc).clone(),
        })
}

/// 全局只读引用（handler 用）。
#[allow(dead_code)]
pub fn cfg() -> &'static AppConfig {
    APP_CONFIG
        .get()
        .expect("config 未安装：main 里必须先调用 config::install(...)")
}

/// 拿到 Arc 句柄（需要把配置传给线程 / 缓存到 State 时用）。
#[allow(dead_code)]
pub fn cfg_arc() -> Arc<AppConfig> {
    APP_CONFIG.get().expect("config 未安装").clone()
}

impl AppConfig {
    /// workspace 根目录；空字符串或 None → ~/.usw
    pub fn workspace_root(workspace: &str) -> PathBuf {
        let ws = workspace.trim();
        if ws.is_empty() {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join(".usw")
        } else {
            PathBuf::from(ws)
        }
    }

    /// 加载配置：
    ///   * config_path 以 `/` 开头 → 绝对路径直接使用
    ///   * config_path 其他非空值 → {workspace}/{config_path}
    ///   * config_path 为空或 None → {workspace}/config.yaml
    ///   * 文件不存在 → AppConfig::default()
    pub fn load(
        workspace: &str,
        config_path: Option<&str>,
    ) -> anyhow::Result<(Self, PathBuf)> {
        let root = Self::workspace_root(workspace);
        let target_path = match config_path.map(|s| s.trim()).filter(|s| !s.is_empty()) {
            Some(p) if p.starts_with('/') => PathBuf::from(p),
            Some(p) => root.join(p),
            None => root.join("config.yaml"),
        };

        let mut cfg: Self = if target_path.exists() {
            let raw = fs::read_to_string(&target_path)
                .with_context(|| format!("读取配置文件失败：{}", target_path.display()))?;
            serde_yaml::from_str(&raw)
                .with_context(|| format!("解析 YAML 配置失败：{}", target_path.display()))?
        } else {
            AppConfig::default()
        };

        cfg.finalize()?;
        Ok((cfg, target_path))
    }
}
