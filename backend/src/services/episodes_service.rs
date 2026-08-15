//! 剧集 service：剧本某一 project 下的单集内容 CRUD + 上下移动。
//!
//! 关键业务约束：
//! - 集号由 level 排序派生，不在数据库中单独存储。前端按 level ASC 排序后
//!   map `(idx, ep) => ({ ...ep, no: idx+1 })` 得到"第几集"。
//! - "上移/下移" = 交换相邻两条的 level（通过 project 下按 level ASC 排序找邻居）。
//! - 默认 level = 毫秒时间戳，新建时若本 project 已有剧集，则取"最大 level + 1"
//!   保证放在末尾。

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{AnyPool, FromRow};
use utoipa::ToSchema;

use crate::common::error_codes::ErrorCode;
use crate::db;

const SELECT_EPISODE: &str = "SELECT id,level,status,created_at,updated_at,\
    project_id,title,content,duration_seconds FROM episodes";

// ---------------------------------------------------------------------------
// 复用 CommonFields（从 project_service 重新 import 比较麻烦，这里独立一份）
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct EpisodeCommonFields {
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
pub struct Episode {
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub base: EpisodeCommonFields,
    #[schema(example = 1234567890123i64)]
    pub project_id: i64,
    #[schema(example = "初入江湖")]
    pub title: String,
    #[schema(example = "山林间，少年背负长剑，……")]
    pub content: Option<String>,
    #[schema(example = 180)]
    pub duration_seconds: Option<i64>,
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateEpisodeReq {
    #[schema(example = 1234567890123i64)]
    pub project_id: i64,
    #[schema(example = "初入江湖")]
    pub title: String,
    #[schema(example = "山林间，少年背负长剑，……")]
    pub content: Option<String>,
    #[schema(example = 180)]
    pub duration_seconds: Option<i64>,
    pub level: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default, ToSchema)]
pub struct UpdateEpisodeReq {
    pub title: Option<String>,
    pub content: Option<String>,
    pub duration_seconds: Option<i64>,
    pub level: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default, utoipa::IntoParams, ToSchema)]
pub struct ListEpisodesQuery {
    #[param(example = 1234567890123i64)]
    pub project_id: i64,
    #[serde(default)]
    pub keyword: Option<String>,
    #[param(example = 100, minimum = 1, maximum = 1000)]
    #[serde(default)]
    pub limit: Option<i64>,
    #[param(example = 0, minimum = 0)]
    #[serde(default)]
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum MoveDirection {
    Up,
    Down,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct MoveEpisodeReq {
    #[schema(example = "up")]
    pub direction: MoveDirection,
}

// ---------------------------------------------------------------------------
// 生成剧集（两种模式）
// ---------------------------------------------------------------------------

/// 模式 A：按故事大纲 + 风格 + 类型 + 集数 调用 AI 生成。
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct GenerateEpisodesByPromptReq {
    #[schema(example = 1234567890123i64)]
    pub project_id: i64,
    /// （可选）指定本次推理用哪个 AI 后端（ux_ai_backends.id，要求 status=active, category=text）。
    /// 若不传则使用 category=text 的 is_default=true 默认后端。
    #[schema(example = "null")]
    #[serde(default)]
    pub ai_backend_id: Option<i64>,
    #[schema(example = "一个现代都市青年穿越回古代，卷入权力斗争，最终找到归家之路。")]
    pub outline: String,
    /// 故事风格：前端下拉枚举 现代/古风/奇幻/日常，此处保留原始字符串
    #[schema(example = "古风")]
    pub style: String,
    /// 剧本类型：剧情/喜剧/冒险……
    #[schema(example = "剧情")]
    pub genre: String,
    /// 要生成的集数（1-100）
    pub count: i32,
}

/// 模式 B：导入小说全文（txt/md 文本），AI 解析后切分为多集。
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct GenerateEpisodesByImportReq {
    #[schema(example = 1234567890123i64)]
    pub project_id: i64,
    /// （可选）指定本次推理用哪个 AI 后端（同 ai_backend_id 说明）。
    #[schema(example = "null")]
    #[serde(default)]
    pub ai_backend_id: Option<i64>,
    /// 文件扩展名，用于校验（txt/md）
    #[schema(example = "md")]
    pub file_ext: String,
    /// 小说正文内容
    #[schema(example = "第一章 初入江湖……\n第二章 剑指苍穹……")]
    pub content: String,
    /// （可选）AI 生成时提示的风格关键词，若不填则从正文推断
    #[schema(example = "古风", default = "")]
    #[serde(default)]
    pub style_hint: String,
    /// （可选）AI 生成时提示的类型关键词
    #[schema(example = "冒险", default = "")]
    #[serde(default)]
    pub genre_hint: String,
}

// ---------------------------------------------------------------------------
// AI 生成一集的内部 DTO：用于 LLM 返回 JSON 数组的单项结构
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct GeneratedEpisode {
    /// 单集标题（3-20 字）
    pub title: String,
    /// 单集剧本正文（建议 ≥500 字，对白+场景）
    pub content: String,
    /// 预估时长（秒），可为空，service 会按字数/200 字/分钟兜底
    #[serde(default)]
    pub duration_seconds: Option<i64>,
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

fn validate_title(title: &str) -> Result<String, crate::common::error::AppError> {
    let t = title.trim().to_string();
    if t.is_empty() {
        return Err(err(ErrorCode::EpisodeTitleInvalid, "剧集标题不能为空"));
    }
    if t.len() > 200 {
        return Err(err(
            ErrorCode::EpisodeTitleInvalid,
            "剧集标题不能超过 200 字符",
        ));
    }
    Ok(t)
}

fn trim_optional(s: Option<String>) -> Option<String> {
    s.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    })
}

/// 返回指定 project 下 status=active 的剧集（按 level ASC），方便 move 与 AI 生成。
pub async fn list_active_ids_for_project(
    pool: &AnyPool,
    project_id: i64,
) -> Result<Vec<(i64, i64)>, crate::common::error::AppError> {
    let rows: Vec<(i64, i64)> = sqlx::query_as::<_, (i64, i64)>(
        "SELECT id,level FROM episodes WHERE status='active' AND project_id=? \
         ORDER BY level ASC, id ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询剧集顺序失败：{e}")))?;
    Ok(rows)
}

/// project 下末尾 level + 1（若空则用毫秒默认值）。
pub async fn next_level_for_project(
    pool: &AnyPool,
    project_id: i64,
) -> Result<i64, crate::common::error::AppError> {
    let row: Option<(i64,)> = sqlx::query_as::<_, (i64,)>(
        "SELECT level FROM episodes WHERE status='active' AND project_id=? \
         ORDER BY level DESC LIMIT 1",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询最大 level 失败：{e}")))?;
    Ok(match row {
        Some((lv,)) => lv + 1,
        None => db::default_level(),
    })
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

pub async fn list(
    pool: &AnyPool,
    q: ListEpisodesQuery,
) -> Result<Vec<Episode>, crate::common::error::AppError> {
    let limit = q.limit.unwrap_or(500).clamp(1, 2000);
    let offset = q.offset.unwrap_or(0).max(0);

    let kw = q.keyword.filter(|s| !s.trim().is_empty());
    let (where_clause, kw_param) = match kw {
        Some(k) => (
            "WHERE status='active' AND project_id=? AND (title LIKE ? OR content LIKE ?)",
            Some(format!("%{k}%")),
        ),
        None => ("WHERE status='active' AND project_id=?", None),
    };
    let sql = format!(
        "{SELECT_EPISODE} {where_clause} ORDER BY level ASC, id ASC LIMIT ? OFFSET ?"
    );
    let mut query = sqlx::query_as::<_, Episode>(&sql).bind(q.project_id);
    if let Some(kp) = kw_param.as_deref() {
        query = query.bind(kp).bind(kp);
    }
    query = query.bind(limit).bind(offset);
    query
        .fetch_all(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询剧集失败：{e}")))
}

pub async fn get_by_id(
    pool: &AnyPool,
    id: i64,
) -> Result<Episode, crate::common::error::AppError> {
    let sql = format!("{SELECT_EPISODE} WHERE id=? AND status='active' LIMIT 1");
    let row: Option<Episode> = sqlx::query_as(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("查询剧集失败：{e}")))?;
    row.ok_or_else(|| err(ErrorCode::EpisodeNotFound, format!("剧集不存在：{id}")))
}

pub async fn create(
    pool: &AnyPool,
    req: CreateEpisodeReq,
) -> Result<Episode, crate::common::error::AppError> {
    let title = validate_title(&req.title)?;
    let project_id = req.project_id;
    let content = trim_optional(req.content);
    let duration = req.duration_seconds.and_then(|d| if d <= 0 { None } else { Some(d) });
    let level = match req.level {
        Some(lv) if lv > 0 => lv,
        _ => next_level_for_project(pool, project_id).await?,
    };
    let id = db::next_id();
    let now = now_iso();

    sqlx::query(
        "INSERT INTO episodes(id,level,status,created_at,updated_at,project_id,title,content,duration_seconds) \
         VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(id)
    .bind(level)
    .bind("active")
    .bind(&now)
    .bind(&now)
    .bind(project_id)
    .bind(&title)
    .bind(content.as_deref())
    .bind(duration)
    .execute(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("创建剧集失败：{e}")))?;

    get_by_id(pool, id).await
}

pub async fn update(
    pool: &AnyPool,
    id: i64,
    req: UpdateEpisodeReq,
) -> Result<Episode, crate::common::error::AppError> {
    let old = get_by_id(pool, id).await?;

    let final_title = match req.title {
        Some(n) => validate_title(&n)?,
        None => old.title.clone(),
    };
    let content_set = req.content.clone();
    let final_content = match content_set {
        Some(c) if c.trim().is_empty() => None,
        Some(c) => Some(c),
        None => old.content.clone(),
    };
    let final_duration = match req.duration_seconds {
        Some(0) => None,
        Some(d) if d > 0 => Some(d),
        _ => old.duration_seconds,
    };
    let final_level = req.level.unwrap_or(old.base.level);

    let nothing_changed = final_title == old.title
        && final_content == old.content
        && final_duration == old.duration_seconds
        && final_level == old.base.level;
    if nothing_changed {
        return Ok(old);
    }

    let now = now_iso();
    sqlx::query(
        "UPDATE episodes SET title=?, content=?, duration_seconds=?, level=?, updated_at=? \
         WHERE id=? AND status='active'",
    )
    .bind(&final_title)
    .bind(final_content.as_deref())
    .bind(final_duration)
    .bind(final_level)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("更新剧集失败：{e}")))?;

    get_by_id(pool, id).await
}

pub async fn delete(
    pool: &AnyPool,
    id: i64,
    mode: &str,
) -> Result<(), crate::common::error::AppError> {
    let _ = get_by_id(pool, id).await?;
    match mode {
        "hard" => {
            let res = sqlx::query("DELETE FROM episodes WHERE id=? AND status='active'")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("硬删剧集失败：{e}")))?;
            if res.rows_affected() == 0 {
                return Err(err(ErrorCode::EpisodeNotFound, format!("剧集不存在：{id}")));
            }
        }
        _ => {
            let now = now_iso();
            let res = sqlx::query(
                "UPDATE episodes SET status='deleted', updated_at=? WHERE id=? AND status='active'",
            )
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("软删剧集失败：{e}")))?;
            if res.rows_affected() == 0 {
                return Err(err(ErrorCode::EpisodeNotFound, format!("剧集不存在：{id}")));
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Move（上下移动，交换相邻两条的 level）
// ---------------------------------------------------------------------------

pub async fn move_episode(
    pool: &AnyPool,
    id: i64,
    direction: MoveDirection,
) -> Result<Episode, crate::common::error::AppError> {
    let cur = get_by_id(pool, id).await?;
    let pid = cur.project_id;
    let list = list_active_ids_for_project(pool, pid).await?;

    let pos = list
        .iter()
        .position(|(rid, _)| *rid == id)
        .ok_or_else(|| err(ErrorCode::EpisodeReorderFailed, "目标剧集不在排序队列中"))?;

    let neighbor_pos = match direction {
        MoveDirection::Up => {
            if pos == 0 {
                return Err(err(ErrorCode::EpisodeBadMove, "已经是第一集，无法继续上移"));
            }
            pos - 1
        }
        MoveDirection::Down => {
            if pos + 1 >= list.len() {
                return Err(err(ErrorCode::EpisodeBadMove, "已经是最后一集，无法继续下移"));
            }
            pos + 1
        }
    };

    let (neighbor_id, neighbor_level) = list[neighbor_pos];
    let cur_level = list[pos].1;
    let now = now_iso();

    // 先把当前行的 level 设为临时值避免唯一/相同值问题（SQLite level 列无唯一索引，直接互换即可）
    sqlx::query("UPDATE episodes SET level=?, updated_at=? WHERE id=? AND status='active'")
        .bind(neighbor_level)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("移动剧集失败：{e}")))?;
    sqlx::query("UPDATE episodes SET level=?, updated_at=? WHERE id=? AND status='active'")
        .bind(cur_level)
        .bind(&now)
        .bind(neighbor_id)
        .execute(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("移动剧集失败：{e}")))?;

    get_by_id(pool, id).await
}

// ---------------------------------------------------------------------------
// 批量插入（AI 生成后使用，保证按顺序的 level 连续递增且从末尾接起）
// ---------------------------------------------------------------------------

pub async fn bulk_create(
    pool: &AnyPool,
    project_id: i64,
    generated: Vec<GeneratedEpisode>,
) -> Result<Vec<Episode>, crate::common::error::AppError> {
    if generated.is_empty() {
        return Ok(Vec::new());
    }
    let mut start_level = next_level_for_project(pool, project_id).await?;
    let mut result = Vec::with_capacity(generated.len());
    for item in generated {
        let title = validate_title(&item.title)?;
        let content = Some(item.content.trim().to_string()).filter(|c| !c.is_empty());
        let dur = item.duration_seconds.or_else(|| {
            let chars = content.as_deref().map(|c| c.chars().count()).unwrap_or_default();
            if chars == 0 {
                None
            } else {
                Some(((chars as i64).max(200) * 60 / 220).clamp(60, 3600))
            }
        });
        let id = db::next_id();
        let now = now_iso();
        sqlx::query(
            "INSERT INTO episodes(id,level,status,created_at,updated_at,project_id,title,content,duration_seconds) \
             VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(id)
        .bind(start_level)
        .bind("active")
        .bind(&now)
        .bind(&now)
        .bind(project_id)
        .bind(&title)
        .bind(content.as_deref())
        .bind(dur)
        .execute(pool)
        .await
        .map_err(|e| err(ErrorCode::DatabaseQueryError, format!("批量插入剧集失败：{e}")))?;
        let ep = get_by_id(pool, id).await?;
        result.push(ep);
        start_level += 1;
    }
    Ok(result)
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_title_checks() {
        assert!(validate_title("").is_err());
        assert!(validate_title("    ").is_err());
        assert!(validate_title(&"x".repeat(201)).is_err());
        assert!(validate_title("ok").is_ok());
    }
}
