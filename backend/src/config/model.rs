//! 全局配置结构定义：只保留 "数据 + 工具 impl"，加载/单例放 mod.rs

use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
};

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// 配置结构定义（顺序要和 config.yaml 的层级一一对应）
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub cors: CorsConfig,
    pub site_info: SiteInfoConfig,
    pub logging: LoggingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ServerConfig {
    #[schema(example = "0.0.0.0")]
    pub host: String,
    #[schema(example = 5000, minimum = 1, maximum = 65535)]
    pub port: u16,
    #[schema(example = 15)]
    pub graceful_shutdown_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CorsConfig {
    pub allow_any_origin: bool,
    #[schema(example = json!(["http://127.0.0.1:5173"]))]
    pub allow_origins: Vec<String>,
    #[schema(example = json!(["GET","POST","PUT","DELETE"]))]
    pub allow_methods: Vec<String>,
    #[schema(example = json!(["Content-Type","Authorization"]))]
    pub allow_headers: Vec<String>,
    pub allow_credentials: bool,
    pub max_age_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SiteInfoConfig {
    #[schema(example = "Unlimited Story Works")]
    pub name: String,
    #[schema(example = "无限绘卷")]
    pub name_zh: String,
    #[schema(example = "用 AI 生成你想要的任何故事")]
    pub slogan: String,
    #[schema(example = "一站式 AI 剧本 / 任务 / 音视频管线平台")]
    pub description: String,
    #[schema(example = "0.1.0")]
    pub version: String,
    /// development / staging / production
    #[schema(example = "development")]
    pub environment: String,
    pub features: Vec<SiteFeature>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SiteFeature {
    #[schema(example = "ai_script")]
    pub key: String,
    #[schema(example = "AI 剧本生成")]
    pub name: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LoggingConfig {
    /// trace / debug / info / warn / error
    #[schema(example = "debug")]
    pub level: String,
    /// console / file / both
    #[schema(example = "both")]
    pub target: String,
    #[schema(example = "./logs")]
    pub file_dir: String,
    #[schema(example = "app")]
    pub file_prefix: String,
    /// pretty / compact / json
    #[schema(example = "pretty")]
    pub format: String,
    /// 日志文件保留天数。缺省（yaml 不写或写 0）按 7 天兜底。
    #[serde(default)]
    #[schema(example = 7, minimum = 1)]
    pub keep_days: i64,
}

// ---------------------------------------------------------------------------
// 工具方法（加载 & 校验在 mod.rs 里做）
// ---------------------------------------------------------------------------

impl AppConfig {
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.server.port == 0 {
            return Err(anyhow!("server.port 不能为 0"));
        }
        let valid_targets = ["console", "file", "both"];
        if !valid_targets.contains(&self.logging.target.as_str()) {
            return Err(anyhow!(
                "logging.target 必须是 {:?}，当前是：{}",
                valid_targets,
                self.logging.target
            ));
        }
        let valid_formats = ["pretty", "compact", "json"];
        if !valid_formats.contains(&self.logging.format.as_str()) {
            return Err(anyhow!(
                "logging.format 必须是 {:?}，当前是：{}",
                valid_formats,
                self.logging.format
            ));
        }
        if self.logging.keep_days < 0 {
            return Err(anyhow!(
                "logging.keep_days 不能为负数，当前是：{}",
                self.logging.keep_days
            ));
        }
        Ok(())
    }

    /// 返回 std::net::SocketAddr，直接传给 TcpListener::bind
    pub fn socket_addr(&self) -> anyhow::Result<SocketAddr> {
        let ip: IpAddr = self
            .server
            .host
            .parse()
            .with_context(|| format!("无效 server.host：{}", self.server.host))?;
        Ok(SocketAddr::new(ip, self.server.port))
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: Ipv4Addr::UNSPECIFIED.to_string(),
                port: 5000,
                graceful_shutdown_secs: 15,
            },
            cors: CorsConfig {
                allow_any_origin: true,
                allow_origins: vec![
                    "http://127.0.0.1:5173".into(),
                    "http://localhost:5173".into(),
                ],
                allow_methods: vec![
                    "GET".into(), "POST".into(), "PUT".into(),
                    "DELETE".into(), "PATCH".into(), "OPTIONS".into(),
                ],
                allow_headers: vec![
                    "Content-Type".into(), "Authorization".into(),
                    "Accept".into(), "X-Requested-With".into(),
                ],
                allow_credentials: false,
                max_age_secs: 86400,
            },
            site_info: SiteInfoConfig {
                name: "Unlimited Story Works".into(),
                name_zh: "无限绘卷".into(),
                slogan: "Demo fallback".into(),
                description: "Default config（未加载 yaml 时使用）".into(),
                version: "0.1.0".into(),
                environment: "development".into(),
                features: vec![],
            },
            logging: LoggingConfig {
                level: "info".into(),
                target: "console".into(),
                file_dir: "./logs".into(),
                file_prefix: "app".into(),
                format: "pretty".into(),
                keep_days: 7,
            },
        }
    }
}
