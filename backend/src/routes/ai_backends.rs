//! AI 推理后端配置路由（全局资源，不绑定 project）。
//!
//! 路径前缀 /api/v1/ai-backends。

use axum::{
    Extension, Router,
    extract::{Path, Query},
    routing::{get, post},
};
use crate::common::prelude::*;
use crate::middleware::delete_mode::DeleteMode;
use crate::services::ai_backends_service::{
    AiBackend, CreateAiBackendReq, ListAiBackendsQuery,
    UpdateAiBackendReq,
};
use crate::db;

pub fn router() -> Router {
    Router::new()
        .route("/api/v1/ai-backends", get(list_ai_backends).post(create_ai_backend))
        .route(
            "/api/v1/ai-backends/{id}",
            get(get_ai_backend)
                .put(update_ai_backend)
                .patch(update_ai_backend)
                .delete(delete_ai_backend),
        )
        .route(
            "/api/v1/ai-backends/{id}/set-default",
            post(set_ai_backend_default),
        )
}

#[utoipa::path(
    get,
    path = "/api/v1/ai-backends",
    tag = "AIBackends",
    params(ListAiBackendsQuery),
    responses(
        (status = 200, description = "AI 后端配置列表", body = inline(ApiResponse<Vec<AiBackend>>))
    )
)]
pub async fn list_ai_backends(
    Query(q): Query<ListAiBackendsQuery>,
) -> Result<ApiResponse<Vec<AiBackend>>, AppError> {
    let pool = db();
    let rows = crate::services::ai_backends_service::list(pool, q).await?;
    Ok(ok(rows))
}

#[utoipa::path(
    get,
    path = "/api/v1/ai-backends/{id}",
    tag = "AIBackends",
    params(("id" = i64, Path, description = "AI 配置 ID", example = 1234567890123i64)),
    responses(
        (status = 200, description = "配置详情", body = inline(ApiResponse<AiBackend>)),
        (status = 513, description = "配置不存在", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn get_ai_backend(
    Path(id): Path<i64>,
) -> Result<ApiResponse<AiBackend>, AppError> {
    let pool = db();
    let row = crate::services::ai_backends_service::get_by_id(pool, id).await?;
    Ok(ok(row))
}

#[utoipa::path(
    post,
    path = "/api/v1/ai-backends",
    tag = "AIBackends",
    request_body = CreateAiBackendReq,
    responses(
        (status = 200, description = "创建成功", body = inline(ApiResponse<AiBackend>)),
        (status = 513, description = "参数不合法 / 名称重复 / 类型不支持", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn create_ai_backend(
    axum::Json(req): axum::Json<CreateAiBackendReq>,
) -> Result<ApiResponse<AiBackend>, AppError> {
    let pool = db();
    let row = crate::services::ai_backends_service::create(pool, req).await?;
    Ok(ok(row))
}

#[utoipa::path(
    put,
    path = "/api/v1/ai-backends/{id}",
    tag = "AIBackends",
    params(("id" = i64, Path, description = "AI 配置 ID")),
    request_body = UpdateAiBackendReq,
    responses(
        (status = 200, description = "更新成功", body = inline(ApiResponse<AiBackend>)),
        (status = 513, description = "配置不存在 / 参数不合法", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn update_ai_backend(
    Path(id): Path<i64>,
    axum::Json(req): axum::Json<UpdateAiBackendReq>,
) -> Result<ApiResponse<AiBackend>, AppError> {
    let pool = db();
    let row = crate::services::ai_backends_service::update(pool, id, req).await?;
    Ok(ok(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ai-backends/{id}",
    tag = "AIBackends",
    params(("id" = i64, Path, description = "AI 配置 ID")),
    responses(
        (status = 200, description = "删除成功", body = ApiResponse<serde_json::Value>),
        (status = 513, description = "配置不存在", body = ApiResponse<serde_json::Value>),
    )
)]
pub async fn delete_ai_backend(
    Path(id): Path<i64>,
    Extension(mode): Extension<DeleteMode>,
) -> Result<ApiResponse<()>, AppError> {
    let pool = db();
    crate::services::ai_backends_service::delete(pool, id, &mode.0).await?;
    Ok(ok_empty())
}

#[utoipa::path(
    post,
    path = "/api/v1/ai-backends/{id}/set-default",
    tag = "AIBackends",
    params(("id" = i64, Path, description = "AI 配置 ID")),
    responses(
        (status = 200, description = "设置成功", body = inline(ApiResponse<AiBackend>)),
        (status = 513, description = "配置不存在", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn set_ai_backend_default(
    Path(id): Path<i64>,
) -> Result<ApiResponse<AiBackend>, AppError> {
    let pool = db();
    let row = crate::services::ai_backends_service::set_default(pool, id).await?;
    Ok(ok(row))
}
