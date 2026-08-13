//! Project 领域服务：projects 表的 CRUD。
//!
//! 业务约束：
//! - 增删改都只能操作 status=active 的数据
//! - 软删除将 status 改为 deleted，硬删除物理移除行
//! - 查询只返回 status=active 的数据

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, FromRow};
use utoipa::ToSchema;

use crate::common::error_codes::ErrorCode;
use crate::db;

/// 删除模式：soft = 软删（status → deleted），hard = 物理删除。
/// TODO 后期由中间件控制，目前固定为 soft。
const DELETE_MODE: &str = "soft";

const SELECT_PROJECT: &str =
    "SELECT id,level,status,created_at,updated_at,name,description,cover_image FROM projects";

// ---------------------------------------------------------------------------
// 通用列（每张表都有）
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct CommonFields {
    #[schema(example = 1725000000000i64)]
    pub id: i64,
    #[schema(example = 1720000000000i64)]
    pub level: i64,
    #[schema(example = "active")]
    pub status: String,
    #[schema(example = "2026-08-12T10:00:00Z")]
    pub created_at: String,
    #[schema(example = "2026-08-12T10:00:00Z")]
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// 实体
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Project {
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub base: CommonFields,
    #[schema(example = "我的第一部动画长片")]
    pub name: String,
    #[schema(example = "一个关于旅行和回家的故事")]
    pub description: Option<String>,
    #[schema(example = "https://.../cover.jpg")]
    pub cover_image: Option<String>,
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateProjectReq {
    #[schema(example = "我的第一部动画长片")]
    pub name: String,
    #[schema(example = "一个关于旅行和回家的故事")]
    pub description: Option<String>,
    pub cover_image: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateProjectReq {
    pub name: Option<String>,
    pub description: Option<String>,
    pub cover_image: Option<String>,
    pub level: Option<i64>,
}

// ---------------------------------------------------------------------------
// 查询参数
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default, utoipa::IntoParams, ToSchema)]
pub struct ListProjectsQuery {
    #[serde(default)]
    pub keyword: Option<String>,
    #[param(example = 20, minimum = 1, maximum = 500)]
    #[serde(default)]
    pub limit: Option<i64>,
    #[param(example = 0, minimum = 0)]
    #[serde(default)]
    pub offset: Option<i64>,
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

fn now_iso() -> String {
    chrono::Local::now().with_timezone(&Utc).to_rfc3339()
}

fn err(code: ErrorCode, msg: impl Into<String>) -> crate::common::error::AppError {
    crate::common::error::AppError::from_code_with_msg(code, msg)
}

fn validate_name(name: &str) -> Result<String, crate::common::error::AppError> {
    let t = name.trim().to_string();
    if t.is_empty() {
        return Err(err(ErrorCode::ProjectNameInvalid, "项目名称不能为空"));
    }
    if t.len() > 120 {
        return Err(err(ErrorCode::ProjectNameInvalid, "项目名称不能超过 120 字符"));
    }
    Ok(t)
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/// 列表查询，只返回 status=active 的项目。
pub async fn list(
    pool: &AnyPool,
    q: ListProjectsQuery,
) -> Result<Vec<Project>, crate::common::error::AppError> {
    let limit = q.limit.unwrap_or(20).clamp(1, 500);
    let offset = q.offset.unwrap_or(0).max(0);

    let kw = q.keyword.filter(|s| !s.trim().is_empty());
    let (where_clause, kw_param) = match kw {
        Some(k) => (
            "WHERE status = 'active' AND (name LIKE ? OR description LIKE ?)",
            Some(format!("%{k}%")),
        ),
        None => ("WHERE status = 'active'", None),
    };

    let sql = format!("{SELECT_PROJECT} {where_clause} ORDER BY level DESC, id DESC LIMIT ? OFFSET ?");

    let mut query = sqlx::query_as::<_, Project>(&sql);
    if let Some(kp) = kw_param.as_deref() {
        query = query.bind(kp).bind(kp);
    }
    query = query.bind(limit).bind(offset);

    query
        .fetch_all(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询 projects 失败：{e}")))
}

/// 按 ID 查询，只返回 status=active 的项目。
pub async fn get_by_id(
    pool: &AnyPool,
    id: i64,
) -> Result<Project, crate::common::error::AppError> {
    let sql = format!("{SELECT_PROJECT} WHERE id = ? AND status = 'active' LIMIT 1");
    let row: Option<Project> = sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询 project 失败：{e}")))?;

    row.ok_or_else(|| err(ErrorCode::ProjectNotFound, format!("project 不存在：{id}")))
}

/// 创建项目，status 固定为 active。
pub async fn create(
    pool: &AnyPool,
    req: CreateProjectReq,
) -> Result<Project, crate::common::error::AppError> {
    let name = validate_name(&req.name)?;
    let id = db::next_id();
    let level = db::default_level();
    let now = now_iso();

    sqlx::query(
        "INSERT INTO projects (id,level,status,created_at,updated_at,name,description,cover_image) \
         VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(id)
    .bind(level)
    .bind("active")
    .bind(&now)
    .bind(&now)
    .bind(&name)
    .bind(req.description.as_deref())
    .bind(req.cover_image.as_deref())
    .execute(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("创建 project 失败：{e}")))?;

    get_by_id(pool, id).await
}

/// 更新项目，只允许操作 status=active 的数据。不修改 status。
pub async fn update(
    pool: &AnyPool,
    id: i64,
    req: UpdateProjectReq,
) -> Result<Project, crate::common::error::AppError> {
    let old = get_by_id(pool, id).await?;

    let name = match req.name {
        Some(n) => Some(validate_name(&n)?),
        None => None,
    };

    if name.is_none() && req.description.is_none() && req.cover_image.is_none() && req.level.is_none() {
        return Ok(old);
    }

    let final_name = name.as_deref().unwrap_or(&old.name);
    let final_desc = req.description.as_deref().or(old.description.as_deref());
    let final_cover = req.cover_image.as_deref().or(old.cover_image.as_deref());
    let final_level = req.level.unwrap_or(old.base.level);
    let now = now_iso();

    sqlx::query(
        "UPDATE projects SET name=?, description=?, cover_image=?, level=?, updated_at=? \
         WHERE id=? AND status='active'",
    )
    .bind(final_name)
    .bind(final_desc)
    .bind(final_cover)
    .bind(final_level)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("更新 project 失败：{e}")))?;

    get_by_id(pool, id).await
}

/// 删除项目，按 DELETE_MODE 常量决定软删/硬删。只允许操作 status=active 的数据。
pub async fn delete(
    pool: &AnyPool,
    id: i64,
) -> Result<(), crate::common::error::AppError> {
    // 确认存在且 active
    let _ = get_by_id(pool, id).await?;

    match DELETE_MODE {
        "hard" => {
            let res = sqlx::query("DELETE FROM projects WHERE id=? AND status='active'")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("硬删除 project 失败：{e}")))?;
            if res.rows_affected() == 0 {
                return Err(err(ErrorCode::ProjectNotFound, format!("project 不存在：{id}")));
            }
        }
        _ => {
            let now = now_iso();
            let res = sqlx::query("UPDATE projects SET status='deleted', updated_at=? WHERE id=? AND status='active'")
                .bind(&now)
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("软删 project 失败：{e}")))?;
            if res.rows_affected() == 0 {
                return Err(err(ErrorCode::ProjectNotFound, format!("project 不存在：{id}")));
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_name_rejects_empty_and_long() {
        assert!(validate_name("").is_err());
        assert!(validate_name("   ").is_err());
        assert!(validate_name(&"a".repeat(121)).is_err());
        assert!(validate_name("ok").is_ok());
    }
}
