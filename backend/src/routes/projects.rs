//! Projects 业务路由：项目资源 CRUD 接口。
//!
//! 路径前缀 /api/v1/projects。所有业务资源在 service 层按 project_id 逻辑隔离。
//! id 是雪花算法整数（前端数字类型），路由统一用 `{id}`（Axum 0.8 格式）。

use axum::{
    Router,
    extract::{Path, Query},
    routing::get,
};
use crate::common::prelude::*;
use crate::services::project_service::{
    CreateProjectReq, ListProjectsQuery, Project, UpdateProjectReq,
};
use crate::db;

pub fn router() -> Router {
    Router::new()
        .route("/api/v1/projects", get(list_projects).post(create_project))
        .route(
            "/api/v1/projects/{id}",
            get(get_project).put(update_project).patch(update_project).delete(delete_project),
        )
}

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

/// 项目列表查询
#[utoipa::path(
    get,
    path = "/api/v1/projects",
    tag = "Projects",
    params(ListProjectsQuery),
    responses(
        (status = 200, description = "项目列表", body = inline(ApiResponse<Vec<Project>>))
    )
)]
pub async fn list_projects(
    Query(q): Query<ListProjectsQuery>,
) -> Result<ApiResponse<Vec<Project>>, AppError> {
    let pool = db();
    let rows = crate::services::project_service::list(pool, q).await?;
    Ok(ok(rows))
}

/// 项目详情
#[utoipa::path(
    get,
    path = "/api/v1/projects/{id}",
    tag = "Projects",
    params(("id" = i64, Path, description = "Project 雪花 ID（数字）", example = 1234567890123i64)),
    responses(
        (status = 200, description = "项目详情", body = inline(ApiResponse<Project>)),
        (status = 513, description = "项目不存在", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn get_project(
    Path(id): Path<i64>,
) -> Result<ApiResponse<Project>, AppError> {
    let pool = db();
    let row = crate::services::project_service::get_by_id(pool, id).await?;
    Ok(ok(row))
}

/// 新建项目
#[utoipa::path(
    post,
    path = "/api/v1/projects",
    tag = "Projects",
    request_body = CreateProjectReq,
    responses(
        (status = 200, description = "创建成功", body = inline(ApiResponse<Project>)),
        (status = 513, description = "名字为空/超长", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn create_project(
    axum::Json(req): axum::Json<CreateProjectReq>,
) -> Result<ApiResponse<Project>, AppError> {
    let pool = db();
    let row = crate::services::project_service::create(pool, req).await?;
    Ok(ok(row))
}

/// 更新项目（PUT / PATCH 共用）。
#[utoipa::path(
    put,
    path = "/api/v1/projects/{id}",
    tag = "Projects",
    params(("id" = i64, Path, description = "Project 雪花 ID（数字）")),
    request_body = UpdateProjectReq,
    responses(
        (status = 200, description = "更新成功", body = inline(ApiResponse<Project>)),
        (status = 513, description = "项目不存在 / 参数不合法", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn update_project(
    Path(id): Path<i64>,
    axum::Json(req): axum::Json<UpdateProjectReq>,
) -> Result<ApiResponse<Project>, AppError> {
    let pool = db();
    let row = crate::services::project_service::update(pool, id, req).await?;
    Ok(ok(row))
}

/// 删除项目
#[utoipa::path(
    delete,
    path = "/api/v1/projects/{id}",
    tag = "Projects",
    params(("id" = i64, Path, description = "Project 雪花 ID（数字）")),
    responses(
        (status = 200, description = "删除成功", body = ApiResponse<serde_json::Value>),
        (status = 513, description = "项目不存在", body = ApiResponse<serde_json::Value>),
    )
)]
pub async fn delete_project(
    Path(id): Path<i64>,
) -> Result<ApiResponse<()>, AppError> {
    let pool = db();
    crate::services::project_service::delete(pool, id).await?;
    Ok(ok_empty())
}
