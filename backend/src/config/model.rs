//! 全局配置结构定义：纯数据 + 默认值。加载/单例放 mod.rs。
//!
//! 默认值约定：
//!   - ServerConfig.host / port 没有 serde default（finalize 兜底成 127.0.0.1:5000）
//!   - 其他所有字段均有 `#[serde(default)]`，config.yaml 缺段/缺字段仍可启动。

use serde::Deserialize;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/// Web 服务监听配置。host / port 无 serde default，finalize 兜底。
#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: Option<String>,
    pub port: Option<u16>,
    #[serde(default = "default_graceful_shutdown_secs")]
    pub graceful_shutdown_secs: u64,
}

fn default_graceful_shutdown_secs() -> u64 {
    15
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: Some("127.0.0.1".into()),
            port: Some(5000),
            graceful_shutdown_secs: default_graceful_shutdown_secs(),
        }
    }
}

// ---------------------------------------------------------------------------
// Cors
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct CorsConfig {
    #[serde(default = "default_bool_true")]
    pub allow_any_origin: bool,
    #[serde(default)]
    pub allow_origins: Vec<String>,
    #[serde(default = "default_allow_methods")]
    pub allow_methods: Vec<String>,
    #[serde(default = "default_allow_headers")]
    pub allow_headers: Vec<String>,
    #[serde(default)]
    pub allow_credentials: bool,
    #[serde(default = "default_max_age_secs")]
    pub max_age_secs: u64,
}

fn default_bool_true() -> bool { true }

fn default_allow_methods() -> Vec<String> {
    vec!["GET".into(), "POST".into(), "PUT".into(), "PATCH".into(), "DELETE".into(), "OPTIONS".into()]
}

fn default_allow_headers() -> Vec<String> {
    vec!["Content-Type".into(), "Authorization".into(), "Accept".into(), "X-Requested-With".into()]
}

fn default_max_age_secs() -> u64 { 86400 }

impl Default for CorsConfig {
    fn default() -> Self {
        Self {
            allow_any_origin: true,
            allow_origins: vec![
                "http://127.0.0.1:5173".into(),
                "http://localhost:5173".into(),
                "http://0.0.0.0:5173".into(),
            ],
            allow_methods: default_allow_methods(),
            allow_headers: default_allow_headers(),
            allow_credentials: false,
            max_age_secs: default_max_age_secs(),
        }
    }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingConfig {
    #[serde(default = "default_log_level")]
    pub level: String,
    #[serde(default = "default_log_target")]
    pub target: String,
    #[serde(default = "default_log_dir")]
    pub file_dir: String,
    #[serde(default = "default_log_prefix")]
    pub file_prefix: String,
    #[serde(default = "default_log_format")]
    pub format: String,
    #[serde(default = "default_log_keep_days")]
    pub keep_days: i64,
}

fn default_log_level() -> String { "info".into() }
fn default_log_target() -> String { "both".into() }
fn default_log_dir() -> String { "./logs".into() }
fn default_log_prefix() -> String { "app".into() }
fn default_log_format() -> String { "pretty".into() }
fn default_log_keep_days() -> i64 { 7 }

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: default_log_level(),
            target: default_log_target(),
            file_dir: default_log_dir(),
            file_prefix: default_log_prefix(),
            format: default_log_format(),
            keep_days: default_log_keep_days(),
        }
    }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/// 数据库配置（纯字段，不含路径拼接 / DSN 构造等运行时逻辑）。
#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    #[serde(default = "default_driver")]
    pub driver: String,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default = "default_db_name")]
    pub name: String,
}

fn default_driver() -> String { "sqlite".into() }
fn default_db_name() -> String { "usw.db".into() }

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            driver: default_driver(),
            host: None,
            port: None,
            username: None,
            password: None,
            name: default_db_name(),
        }
    }
}

// ---------------------------------------------------------------------------
// AppConfig（顶层）
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub server: Option<ServerConfig>,
    #[serde(default)]
    pub cors: Option<CorsConfig>,
    #[serde(default)]
    pub logging: Option<LoggingConfig>,
    #[serde(default)]
    pub database: Option<DatabaseConfig>,
}

impl AppConfig {
    pub fn server(&self) -> ServerConfig { self.server.clone().unwrap_or_default() }
    pub fn cors(&self) -> CorsConfig { self.cors.clone().unwrap_or_default() }
    pub fn logging(&self) -> LoggingConfig { self.logging.clone().unwrap_or_default() }
    pub fn database(&self) -> DatabaseConfig { self.database.clone().unwrap_or_default() }

    /// 启动前调用：None 段填默认值，server.host/port 兜底，再跑 validate。
    pub fn finalize(&mut self) -> anyhow::Result<()> {
        let s = self.server.get_or_insert_with(ServerConfig::default);
        s.host.get_or_insert_with(|| "127.0.0.1".into());
        s.port.get_or_insert(5000);

        self.cors.get_or_insert_with(CorsConfig::default);
        self.logging.get_or_insert_with(LoggingConfig::default);
        self.database.get_or_insert_with(DatabaseConfig::default);

        self.validate()
    }

    fn validate(&self) -> anyhow::Result<()> {
        // server
        if let Some(s) = &self.server {
            if s.graceful_shutdown_secs == 0 {
                anyhow::bail!("server.graceful_shutdown_secs 必须 > 0");
            }
            if s.port == Some(0) {
                anyhow::bail!("server.port 不能为 0");
            }
        }

        // logging
        if let Some(l) = &self.logging {
            const VALID_TARGETS: &[&str] = &["console", "file", "both"];
            let t = l.target.trim().to_ascii_lowercase();
            if !VALID_TARGETS.iter().any(|x| *x == t.as_str()) {
                anyhow::bail!("logging.target 必须是 {VALID_TARGETS:?}，当前：{}", l.target);
            }
            const VALID_FORMATS: &[&str] = &["pretty", "compact", "json"];
            let f = l.format.trim().to_ascii_lowercase();
            if !VALID_FORMATS.iter().any(|x| *x == f.as_str()) {
                anyhow::bail!("logging.format 必须是 {VALID_FORMATS:?}，当前：{}", l.format);
            }
            if l.keep_days < 0 {
                anyhow::bail!("logging.keep_days 不能为负数，当前：{}", l.keep_days);
            }
        }

        Ok(())
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: Some(ServerConfig::default()),
            cors: Some(CorsConfig::default()),
            logging: Some(LoggingConfig::default()),
            database: Some(DatabaseConfig::default()),
        }
    }
}
