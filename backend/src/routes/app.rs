//! 应用元信息路由：根路径、demo 阶段的 /api/v1/config 以及错误演示路由。

use axum::{
    Router,
    extract::Query,
    routing::get,
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::common::prelude::*;
use crate::config::cfg;
use crate::services::config_service;

pub fn router() -> Router {
    Router::new()
        .route("/", get(root))
        .route("/api/v1/config", get(get_config))
        .route("/api/v1/site/info", get(get_site_info))
        .route("/api/v1/error-demo", get(error_demo))
}

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

/// 根路径：返回站点基本信息（名称 / 版本 / 特性开关等）
///
/// 前端首页 Hero 区块、Header Logo 区直接读这个接口，**不需要鉴权**。
#[utoipa::path(
    get,
    path = "/",
    tag = "Meta",
    responses(
        (status = 200, description = "站点信息",
         body = inline(ApiResponse<serde_json::Value>),
         example = json!({
            "code":"S00000","success":true,"message":"ok",
            "data":{
                "name":"Unlimited Story Works",
                "name_zh":"无限绘卷",
                "slogan":"用 AI 生成你想要的任何故事",
                "description":"一站式 AI 剧本 / 任务 / 音视频管线平台",
                "version":"0.1.0",
                "environment":"development",
                "features":[]
            }
         })),
    ),
)]
pub async fn root() -> ApiResponse<serde_json::Value> {
    let c = cfg();
    tracing::debug!(
        target: "usw::http::root",
        name = %c.site_info.name,
        version = %c.site_info.version,
        "serve root info"
    );
    ok(serde_json::json!({
        "name": c.site_info.name,
        "name_zh": c.site_info.name_zh,
        "slogan": c.site_info.slogan,
        "description": c.site_info.description,
        "version": c.site_info.version,
        "environment": c.site_info.environment,
        "features": c.site_info.features,
    }))
}

/// 设置页读取：返回完整 config.yaml 反序列化后的结果
///
/// 前端 Settings.tsx 用来填充默认值；生产阶段会在 service 层做**字段脱敏**。
#[utoipa::path(
    get,
    path = "/api/v1/config",
    tag = "System",
    responses(
        (status = 200, description = "完整运行时配置（server/cors/site_info/logging）",
         body = inline(ApiResponse<crate::config::AppConfig>)),
        (status = 513, description = "服务异常（HTTP 513 I'm a Teapot + 统一信封）",
         body = inline(ApiResponse<serde_json::Value>),
         example = json!({
            "code":"E03001","success":false,
            "message":"配置文件加载或解析失败",
            "data":{"detail":"/etc/usw/config.yaml: No such file or directory"}
         })),
    ),
)]
pub async fn get_config() -> Result<ApiResponse<crate::config::AppConfig>, AppError> {
    tracing::info!(target: "usw::http::app", "GET /api/v1/config");
    let data = config_service::get_full_config()?;
    Ok(ok(data))
}

/// 首页 Header 用：比 /api/v1/config payload 小得多，不带 cors/logging/server 细节
#[utoipa::path(
    get,
    path = "/api/v1/site/info",
    tag = "Meta",
    responses(
        (status = 200, description = "仅站点公开信息（name/slogan/version/environment/features）",
         body = inline(ApiResponse<crate::config::SiteInfoConfig>)),
    ),
)]
pub async fn get_site_info() -> Result<ApiResponse<crate::config::SiteInfoConfig>, AppError> {
    tracing::debug!(target: "usw::http::app", "GET /api/v1/site/info");
    let data = config_service::get_site_info()?;
    Ok(ok(data))
}

// ---------------------------------------------------------------------------
// 错误演示路由（仅 dev，方便 curl 看 513 + 信封格式）
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Serialize, Default, IntoParams, ToSchema)]
pub struct ErrorDemoQuery {
    /// 演示错误类型：invalid_param / anyhow / serde_json / config_load
    #[serde(default)]
    #[param(example = "invalid_param")]
    pub kind: Option<String>,
}

/// 故意触发 4 类错误的演示接口（仅开发阶段保留，生产务必关闭）
///
/// 用来直观验证：
/// 1. 错误走统一信封（success=false + code=Exxxxx + 513 I'm a Teapot）
/// 2. AppError 自动 `tracing::warn/error`（带 target `usw::error`）
/// 3. `data.detail` 字段里保留底层 source chain（含 caused by 多条）
#[utoipa::path(
    get,
    path = "/api/v1/error-demo",
    tag = "System",
    params(ErrorDemoQuery),
    responses(
        (status = 200, description = "（不会触发，这里仅为占位：接口一定返回 Err）",
         body = inline(ApiResponse<serde_json::Value>)),
        (status = 513, description = "演示错误：HTTP 513 + 信封格式",
         body = inline(ApiResponse<serde_json::Value>),
         example = json!({
            "code":"E01002","success":false,
            "message":"password 长度不得少于 8 位",
            "data":null
         })),
    ),
)]
pub async fn error_demo(Query(q): Query<ErrorDemoQuery>) -> Result<ApiResponse<serde_json::Value>, AppError> {
    let kind = q.kind.as_deref().unwrap_or("invalid_param");
    tracing::warn!(
        target: "usw::http::app",
        kind,
        "演示触发错误（demo only，生产环境请移除该接口）"
    );
    config_service::trigger_demo_error(kind)?;
    Ok(ok_empty())
}
