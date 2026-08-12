//! 健康检查：K8s liveness/readiness 用，返回结构最小化。

use axum::{Router, routing::get};

use crate::common::prelude::*;
use crate::config::cfg;

pub fn router() -> Router {
    Router::new().route("/health", get(health))
}

/// K8s liveness / readiness 探针
///
/// - 总是返回 HTTP 200（除非进程挂了）
/// - 适合 Prometheus / 负载均衡健康检查轮询，**payload 极小**
#[utoipa::path(
    get,
    path = "/health",
    tag = "Meta",
    responses(
        (status = 200, description = "服务正常运行",
         body = inline(ApiResponse<serde_json::Value>),
         example = json!(
            {"code":"S00000","success":true,"message":"ok",
             "data":{"status":"ok","version":"0.1.0","env":"development"}}
         )),
    ),
)]
pub async fn health() -> ApiResponse<serde_json::Value> {
    let c = cfg();
    tracing::info!(
        target: "usw::http::health",
        version = %c.site_info.version,
        env = %c.site_info.environment,
        "health check ok"
    );
    ok(serde_json::json!({
        "status": "ok",
        "version": c.site_info.version,
        "env": c.site_info.environment,
    }))
}
