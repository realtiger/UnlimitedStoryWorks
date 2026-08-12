//! 配置模块：model 放结构定义 + 默认值，mod 放加载 + 单例管理。

pub mod model;

pub use model::{AppConfig, LoggingConfig, SiteInfoConfig};

use std::sync::Arc;

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

/// 全局只读引用（绝大多数 handler 够用，零成本）。
pub fn cfg() -> &'static AppConfig {
    APP_CONFIG
        .get()
        .expect("config 未安装：main 里必须先调用 config::install(...)")
}

/// 拿到 Arc 句柄（需要把配置传给线程 / 缓存到 State / service 内部存储时用）。
pub fn cfg_arc() -> Arc<AppConfig> {
    APP_CONFIG.get().expect("config 未安装").clone()
}

impl AppConfig {
    /// 顶层入口：读 yaml + 校验字段。
    pub fn load(path: impl AsRef<std::path::Path>) -> anyhow::Result<Self> {
        use anyhow::Context;
        let path = path.as_ref();
        let raw = std::fs::read_to_string(path)
            .with_context(|| format!("读取配置文件失败：{}", path.display()))?;
        let cfg: AppConfig = serde_yaml::from_str(&raw)
            .with_context(|| format!("解析 YAML 失败：{}", path.display()))?;
        cfg.validate()?;
        Ok(cfg)
    }
}

// 把 anyhow 在这里 pub re-export，避免其他文件重复 use
pub use anyhow::{self};
