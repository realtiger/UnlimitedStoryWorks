//! AI 推理后端配置（全局，所有项目共享）。
//!
//! - 分类：text/image/video/audio/embedding
//! - 每个分类有且仅有一个 is_default=true 的后端（在 set_default/create 更新事务中保证）
//! - 软删除 status=deleted，查询默认过滤。

use std::str::FromStr;

use chrono::{DateTime, FixedOffset, Local, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, FromRow};
use utoipa::ToSchema;

use crate::common::error_codes::ErrorCode;
use crate::db;

const SELECT_AI_BACKEND: &str = "\
SELECT id,level,status,created_at,updated_at,\
       name,category,base_url,model_name,api_key,is_default,extra \
FROM ai_backends";

// ---------------------------------------------------------------------------
// 分类枚举
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
#[schema(rename_all = "snake_case", example = "text")]
pub enum AiCategory {
    Text,
    Image,
    Video,
    Audio,
    Embedding,
}

impl AiCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            AiCategory::Text => "text",
            AiCategory::Image => "image",
            AiCategory::Video => "video",
            AiCategory::Audio => "audio",
            AiCategory::Embedding => "embedding",
        }
    }
}

#[derive(Debug, Clone)]
pub struct AiCategoryParseError(String);

impl std::fmt::Display for AiCategoryParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "不支持的 AI 类型：{}（仅支持 text/image/video/audio/embedding）", self.0)
    }
}

impl FromStr for AiCategory {
    type Err = AiCategoryParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "text" => Ok(AiCategory::Text),
            "image" => Ok(AiCategory::Image),
            "video" => Ok(AiCategory::Video),
            "audio" => Ok(AiCategory::Audio),
            "embedding" => Ok(AiCategory::Embedding),
            _ => Err(AiCategoryParseError(s.to_string())),
        }
    }
}

impl std::fmt::Display for AiCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ---------------------------------------------------------------------------
// 实体 / DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AiBackend {
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

    #[schema(example = "GPT-4o 剧本生成")]
    pub name: String,
    #[schema(value_type = String)]
    pub category: AiCategory,
    #[schema(example = "https://api.example.com/v1")]
    pub base_url: String,
    #[schema(example = "gpt-4o")]
    pub model_name: String,
    #[schema(example = "sk-xxxx")]
    pub api_key: String,
    #[schema(example = true)]
    pub is_default: bool,
    #[schema(example = json!({"org":"my-org"}))]
    pub extra: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateAiBackendReq {
    #[schema(example = "GPT-4o 剧本生成")]
    pub name: String,
    #[schema(value_type = String)]
    pub category: AiCategory,
    #[schema(example = "https://api.example.com/v1")]
    pub base_url: String,
    #[schema(example = "gpt-4o")]
    pub model_name: String,
    #[schema(example = "sk-xxxx")]
    pub api_key: String,
    #[serde(default)]
    #[schema(example = false, default = false)]
    pub is_default: bool,
    pub extra: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default, ToSchema)]
pub struct UpdateAiBackendReq {
    pub name: Option<String>,
    #[schema(value_type = Option<String>, example = "text")]
    pub category: Option<AiCategory>,
    pub base_url: Option<String>,
    pub model_name: Option<String>,
    pub api_key: Option<String>,
    pub is_default: Option<bool>,
    pub extra: Option<String>,
    pub level: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default, utoipa::IntoParams, ToSchema)]
pub struct ListAiBackendsQuery {
    #[serde(default)]
    #[schema(value_type = Option<String>)]
    pub category: Option<AiCategory>,
    #[serde(default)]
    pub keyword: Option<String>,
    #[param(example = 200, minimum = 1, maximum = 1000)]
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
    let now_utc: DateTime<Utc> = Utc::now();
    let local = Local::now();
    let offset = *local.offset();
    let fixed: DateTime<FixedOffset> = now_utc.with_timezone(&offset);
    fixed.to_rfc3339()
}

fn err(code: ErrorCode, msg: impl Into<String>) -> crate::common::error::AppError {
    crate::common::error::AppError::from_code_with_msg(code, msg)
}

fn validate_category(s: &str) -> Result<AiCategory, crate::common::error::AppError> {
    s.parse().map_err(|e: AiCategoryParseError| {
        err(ErrorCode::AiBackendCategoryInvalid, e.to_string())
    })
}

fn trim_required(
    value: Option<&str>,
    field: &str,
    max_len: usize,
) -> Result<String, crate::common::error::AppError> {
    let v = value.map(|s| s.trim()).unwrap_or("").to_string();
    if v.is_empty() {
        return Err(err(
            ErrorCode::AiBackendFieldsMissing,
            format!("字段 {field} 不能为空"),
        ));
    }
    if v.len() > max_len {
        return Err(err(
            ErrorCode::AiBackendFieldsMissing,
            format!("字段 {field} 长度不能超过 {max_len}"),
        ));
    }
    Ok(v)
}

fn int_to_bool(i: i64) -> bool {
    i != 0
}

fn bool_to_int(b: bool) -> i64 {
    if b { 1 } else { 0 }
}

// sqlx::Decode for Any doesn't support bool, we decode as i64 and remap.
#[derive(Debug, Clone, FromRow)]
struct AiBackendRow {
    pub id: i64,
    pub level: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub name: String,
    pub category: String,
    pub base_url: String,
    pub model_name: String,
    pub api_key: String,
    pub is_default: i64,
    pub extra: Option<String>,
}

impl TryFrom<AiBackendRow> for AiBackend {
    type Error = crate::common::error::AppError;
    fn try_from(row: AiBackendRow) -> Result<Self, Self::Error> {
        Ok(AiBackend {
            id: row.id,
            level: row.level,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            name: row.name,
            category: validate_category(&row.category)?,
            base_url: row.base_url,
            model_name: row.model_name,
            api_key: row.api_key,
            is_default: int_to_bool(row.is_default),
            extra: row.extra,
        })
    }
}

// ---------------------------------------------------------------------------
// 业务查询辅助
// ---------------------------------------------------------------------------

async fn list_rows(
    pool: &AnyPool,
    q: ListAiBackendsQuery,
) -> Result<Vec<AiBackendRow>, crate::common::error::AppError> {
    let limit = q.limit.unwrap_or(200).clamp(1, 1000);
    let offset = q.offset.unwrap_or(0).max(0);

    let mut where_parts: Vec<String> = vec!["status <> 'deleted'".into()];
    let mut binds: Vec<String> = Vec::new();

    if let Some(cat) = q.category.as_ref() {
        where_parts.push("category = ?".into());
        binds.push(cat.as_str().to_string());
    }
    if let Some(kw) = q.keyword.as_ref().filter(|s| !s.trim().is_empty()) {
        where_parts.push("(name LIKE ? OR model_name LIKE ? OR base_url LIKE ?)".into());
        let p = format!("%{}%", kw.trim());
        binds.push(p.clone());
        binds.push(p.clone());
        binds.push(p);
    }

    let where_clause = if where_parts.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_parts.join(" AND "))
    };

    let sql = format!(
        "{SELECT_AI_BACKEND} {where_clause} ORDER BY is_default DESC, level DESC, id DESC LIMIT ? OFFSET ?"
    );

    let mut query = sqlx::query_as::<_, AiBackendRow>(&sql);
    for b in binds.iter() {
        query = query.bind(b.as_str());
    }
    query = query.bind(limit).bind(offset);

    query
        .fetch_all(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询 ai_backends 失败：{e}")))
}

async fn get_row_by_id(
    pool: &AnyPool,
    id: i64,
) -> Result<AiBackendRow, crate::common::error::AppError> {
    let sql = format!(
        "{SELECT_AI_BACKEND} WHERE id = ? AND status <> 'deleted' LIMIT 1"
    );
    let row: Option<AiBackendRow> = sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            err(
                ErrorCode::DatabaseQueryError,
                format!("查询 ai_backend 失败：{e}"),
            )
        })?;
    row.ok_or_else(|| err(ErrorCode::AiBackendNotFound, format!("AI 配置不存在：{id}")))
}

/// 同 category 其他 active 行的 is_default 全部清零（用于 create/update/set_default 前保持"同类型只有一个默认"）。
async fn clear_default_for_category(
    pool: &AnyPool,
    category: AiCategory,
    except_id: Option<i64>,
    now: &str,
) -> Result<(), crate::common::error::AppError> {
    let (sql, extra) = match except_id {
        Some(id) => ("UPDATE ai_backends SET is_default=0, updated_at=? WHERE category=? AND status='active' AND id <> ?", Some(id)),
        None => ("UPDATE ai_backends SET is_default=0, updated_at=? WHERE category=? AND status='active'", None),
    };
    let mut query = sqlx::query(sql).bind(now).bind(category.as_str());
    if let Some(id) = extra {
        query = query.bind(id);
    }
    query.execute(pool).await.map_err(|e| {
        err(
            ErrorCode::DatabaseQueryError,
            format!("清除 category={category} 的默认标记失败：{e}"),
        )
    })?;
    Ok(())
}

/// 检查同 category 下名字是否重复（status=active）
async fn check_duplicate_name(
    pool: &AnyPool,
    category: AiCategory,
    name: &str,
    except_id: Option<i64>,
) -> Result<(), crate::common::error::AppError> {
    let sql = match except_id {
        Some(_) => {
            "SELECT id FROM ai_backends WHERE category=? AND name=? AND status='active' AND id<>? LIMIT 1"
        }
        None => "SELECT id FROM ai_backends WHERE category=? AND name=? AND status='active' LIMIT 1",
    };
    let mut query = sqlx::query_as::<_, (i64,)>(sql)
        .bind(category.as_str())
        .bind(name);
    if let Some(id) = except_id {
        query = query.bind(id);
    }
    let exists: Option<(i64,)> = query
        .fetch_optional(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("检查名称重复失败：{e}")))?;
    if exists.is_some() {
        return Err(err(
            ErrorCode::AiBackendNameDuplicated,
            format!("该分类下已存在同名配置：{name}"),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

pub async fn list(
    pool: &AnyPool,
    q: ListAiBackendsQuery,
) -> Result<Vec<AiBackend>, crate::common::error::AppError> {
    let rows = list_rows(pool, q).await?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        out.push(r.try_into()?);
    }
    Ok(out)
}

pub async fn get_by_id(
    pool: &AnyPool,
    id: i64,
) -> Result<AiBackend, crate::common::error::AppError> {
    let row = get_row_by_id(pool, id).await?;
    row.try_into()
}

pub async fn create(
    pool: &AnyPool,
    req: CreateAiBackendReq,
) -> Result<AiBackend, crate::common::error::AppError> {
    let name = trim_required(Some(&req.name), "name", 120)?;
    let base_url = trim_required(Some(&req.base_url), "base_url", 1024)?;
    let model_name = trim_required(Some(&req.model_name), "model_name", 200)?;
    let api_key = trim_required(Some(&req.api_key), "api_key", 2048)?;
    let extra = req.extra.filter(|s| !s.trim().is_empty());

    let now = now_iso();

    // 名称重复校验
    check_duplicate_name(pool, req.category, &name, None).await?;

    // 如果设置为默认，先把该类型已存在的默认清掉（保证唯一默认）
    let set_default = req.is_default;
    if set_default {
        clear_default_for_category(pool, req.category, None, &now).await?;
    }

    let id = db::next_id();
    let level = db::default_level();

    sqlx::query(
        "INSERT INTO ai_backends (id,level,status,created_at,updated_at,\
         name,category,base_url,model_name,api_key,is_default,extra) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(id)
    .bind(level)
    .bind("active")
    .bind(&now)
    .bind(&now)
    .bind(&name)
    .bind(req.category.as_str())
    .bind(&base_url)
    .bind(&model_name)
    .bind(&api_key)
    .bind(bool_to_int(set_default))
    .bind(extra.as_deref())
    .execute(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("创建 AI 配置失败：{e}")))?;

    get_by_id(pool, id).await
}

pub async fn update(
    pool: &AnyPool,
    id: i64,
    req: UpdateAiBackendReq,
) -> Result<AiBackend, crate::common::error::AppError> {
    let old_row = get_row_by_id(pool, id).await?;
    let old_cat = validate_category(&old_row.category)?;

    let new_name = match req.name {
        Some(n) => Some(trim_required(Some(&n), "name", 120)?),
        None => None,
    };
    let new_cat = req.category;
    let new_base = match req.base_url {
        Some(b) => Some(trim_required(Some(&b), "base_url", 1024)?),
        None => None,
    };
    let new_model = match req.model_name {
        Some(m) => Some(trim_required(Some(&m), "model_name", 200)?),
        None => None,
    };
    let new_api = match req.api_key {
        Some(a) => Some(trim_required(Some(&a), "api_key", 2048)?),
        None => None,
    };
    let new_default = req.is_default;
    let new_level = req.level;
    let new_extra = req.extra;

    let noop = new_name.is_none()
        && new_cat.is_none()
        && new_base.is_none()
        && new_model.is_none()
        && new_api.is_none()
        && new_default.is_none()
        && new_level.is_none()
        && new_extra.is_none();
    if noop {
        return get_by_id(pool, id).await;
    }

    let now = now_iso();
    let final_cat = new_cat.unwrap_or(old_cat);
    let final_name = new_name.as_deref().unwrap_or(&old_row.name).to_string();

    // 如果分类或名字发生变化，校验新分类下名字唯一
    if new_cat.is_some() || new_name.is_some() {
        check_duplicate_name(pool, final_cat, &final_name, Some(id)).await?;
    }

    // 当用户显式切换 is_default=true（或分类变更 + 原来就是默认 + 新分类），需要保证同类型唯一默认
    let need_clear_default = match (new_default, old_cat, final_cat) {
        (Some(true), _, _) => true,
        (None, a, b) if a != b && int_to_bool(old_row.is_default) => true,
        _ => false,
    };
    if need_clear_default {
        clear_default_for_category(pool, final_cat, Some(id), &now).await?;
    }

    let final_default_i64: i64 = match (new_default, old_cat, final_cat) {
        (Some(true), _, _) => 1,
        (Some(false), _, _) => 0,
        (None, a, b) if a != b => {
            // 跨分类移动：若原本是默认，新分类保持默认（前面已 clear 掉同分类其他）
            if int_to_bool(old_row.is_default) { 1 } else { old_row.is_default }
        }
        _ => old_row.is_default,
    };

    sqlx::query(
        "UPDATE ai_backends SET \
             name=?, category=?, base_url=?, model_name=?, api_key=?, \
             is_default=?, extra=?, level=?, updated_at=? \
         WHERE id=? AND status='active'",
    )
    .bind(new_name.as_deref().unwrap_or(&old_row.name))
    .bind(final_cat.as_str())
    .bind(new_base.as_deref().unwrap_or(&old_row.base_url))
    .bind(new_model.as_deref().unwrap_or(&old_row.model_name))
    .bind(new_api.as_deref().unwrap_or(&old_row.api_key))
    .bind(final_default_i64)
    .bind(new_extra.as_deref().or(old_row.extra.as_deref()))
    .bind(new_level.unwrap_or(old_row.level))
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("更新 AI 配置失败：{e}")))?;

    get_by_id(pool, id).await
}

pub async fn delete(
    pool: &AnyPool,
    id: i64,
    mode: &str,
) -> Result<(), crate::common::error::AppError> {
    let _ = get_row_by_id(pool, id).await?;

    match mode {
        "hard" => {
            let res = sqlx::query("DELETE FROM ai_backends WHERE id=? AND status<>'deleted'")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("硬删 AI 配置失败：{e}")))?;
            if res.rows_affected() == 0 {
                return Err(err(ErrorCode::AiBackendNotFound, format!("AI 配置不存在：{id}")));
            }
        }
        _ => {
            let now = now_iso();
            let res = sqlx::query(
                "UPDATE ai_backends SET status='deleted', is_default=0, updated_at=? WHERE id=? AND status='active'",
            )
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("软删 AI 配置失败：{e}")))?;
            if res.rows_affected() == 0 {
                return Err(err(ErrorCode::AiBackendNotFound, format!("AI 配置不存在：{id}")));
            }
        }
    }
    Ok(())
}

pub async fn set_default(
    pool: &AnyPool,
    id: i64,
) -> Result<AiBackend, crate::common::error::AppError> {
    let old_row = get_row_by_id(pool, id).await?;
    let now = now_iso();

    // 以当前行的 category 为准，忽略请求体中可能不一致的 category，避免越权
    let row_cat = validate_category(&old_row.category)?;

    clear_default_for_category(pool, row_cat, Some(id), &now).await?;

    sqlx::query("UPDATE ai_backends SET is_default=1, updated_at=? WHERE id=? AND status='active'")
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("设为默认失败：{e}")))?;

    get_by_id(pool, id).await
}

// ---------------------------------------------------------------------------
// 简单自测（非 db 交互）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_roundtrip() {
        for c in [
            AiCategory::Text,
            AiCategory::Image,
            AiCategory::Video,
            AiCategory::Audio,
            AiCategory::Embedding,
        ] {
            let s = c.as_str();
            let back: AiCategory = s.parse().unwrap();
            assert_eq!(c, back);
            assert_eq!(s, format!("{c}"));
        }
        assert!("invalid".parse::<AiCategory>().is_err());
    }

    #[test]
    fn trim_required_rejects_empty_long() {
        assert!(trim_required(Some("   "), "x", 10).is_err());
        assert!(trim_required(Some(&"a".repeat(101)), "x", 100).is_err());
        assert_eq!(trim_required(Some(" hello "), "x", 10).unwrap(), "hello");
    }
}
