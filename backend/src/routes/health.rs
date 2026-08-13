//! 网站健康检查：前端调用、Swagger 展示、反向代理探活。

use axum::{Router, routing::get};

use crate::common::prelude::*;

pub fn router() -> Router {
    Router::new().route("/health", get(health))
}

/// 网站健康检查接口
///
/// 总是返回 HTTP 200（除非进程挂了），适合前端轮询、反向代理探活。
#[utoipa::path(
    get,
    path = "/health",
    tag = "Meta",
    responses(
        (status = 200, description = "服务正常运行",
         body = inline(ApiResponse<serde_json::Value>),
         example = json!(
            {"code":"S00000","success":true,"message":"ok",
             "data":{"status":"ok","name":"Unlimited Story Works","version":"0.1.0"}}
         )),
    ),
)]
pub async fn health() -> ApiResponse<serde_json::Value> {
    tracing::info!(target: "usw::http::health", "health check ok");
    ok(serde_json::json!({
        "status": "ok",
        "name": "Unlimited Story Works",
        "version": "0.1.0",
    }))
}
