//! 剧本（剧集）路由：/api/v1/episodes/**
//! 所有操作按 project_id 限制（list/create 带 project_id）。

use axum::{
    Extension, Router,
    extract::{Path, Query},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Json,
};
use crate::common::prelude::*;
use crate::db;
use crate::middleware::delete_mode::DeleteMode;
use crate::services::episodes_service::{
    CreateEpisodeReq, Episode, GenerateEpisodesByImportReq, GenerateEpisodesByPromptReq,
    GeneratedEpisode, ListEpisodesQuery, MoveEpisodeReq, UpdateEpisodeReq,
};
use futures_util::{Stream, StreamExt};
use std::convert::Infallible;
use std::time::Duration;
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::common::error_codes::ErrorCode;
use crate::common::error::AppError;
use crate::services::ai_backends_service::AiCategory;
use serde::Serialize;

pub fn router() -> Router {
    Router::new()
        .route("/api/v1/episodes", get(list_episodes).post(create_episode))
        .route(
            "/api/v1/episodes/{id}",
            get(get_episode)
                .put(update_episode)
                .patch(update_episode)
                .delete(delete_episode),
        )
        .route("/api/v1/episodes/{id}/move", post(move_episode))
        .route(
            "/api/v1/episodes/generate-by-prompt",
            post(generate_by_prompt),
        )
        .route(
            "/api/v1/episodes/generate-by-import",
            post(generate_by_import),
        )
        .route(
            "/api/v1/episodes/stream/generate-by-prompt",
            post(generate_by_prompt_stream),
        )
        .route(
            "/api/v1/episodes/stream/generate-by-import",
            post(generate_by_import_stream),
        )
}

#[utoipa::path(
    get,
    path = "/api/v1/episodes",
    tag = "Episodes",
    params(ListEpisodesQuery),
    responses(
        (status = 200, description = "剧集列表（按 level ASC 排序，前端按 idx+1 派生集号）", body = inline(ApiResponse<Vec<Episode>>))
    )
)]
pub async fn list_episodes(
    Query(q): Query<ListEpisodesQuery>,
) -> Result<ApiResponse<Vec<Episode>>, AppError> {
    let pool = db();
    let rows = crate::services::episodes_service::list(pool, q).await?;
    Ok(ok(rows))
}

#[utoipa::path(
    get,
    path = "/api/v1/episodes/{id}",
    tag = "Episodes",
    params(("id" = i64, Path, description = "剧集 ID")),
    responses(
        (status = 200, description = "剧集详情", body = inline(ApiResponse<Episode>)),
        (status = 513, description = "剧集不存在", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn get_episode(
    Path(id): Path<i64>,
) -> Result<ApiResponse<Episode>, AppError> {
    let pool = db();
    let row = crate::services::episodes_service::get_by_id(pool, id).await?;
    Ok(ok(row))
}

#[utoipa::path(
    post,
    path = "/api/v1/episodes",
    tag = "Episodes",
    request_body = CreateEpisodeReq,
    responses(
        (status = 200, description = "创建成功", body = inline(ApiResponse<Episode>)),
        (status = 513, description = "标题为空或过长", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn create_episode(
    axum::Json(req): axum::Json<CreateEpisodeReq>,
) -> Result<ApiResponse<Episode>, AppError> {
    let pool = db();
    let row = crate::services::episodes_service::create(pool, req).await?;
    Ok(ok(row))
}

#[utoipa::path(
    put,
    path = "/api/v1/episodes/{id}",
    tag = "Episodes",
    params(("id" = i64, Path, description = "剧集 ID")),
    request_body = UpdateEpisodeReq,
    responses(
        (status = 200, description = "更新成功", body = inline(ApiResponse<Episode>)),
        (status = 513, description = "剧集不存在 / 标题不合法", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn update_episode(
    Path(id): Path<i64>,
    axum::Json(req): axum::Json<UpdateEpisodeReq>,
) -> Result<ApiResponse<Episode>, AppError> {
    let pool = db();
    let row = crate::services::episodes_service::update(pool, id, req).await?;
    Ok(ok(row))
}

#[utoipa::path(
    delete,
    path = "/api/v1/episodes/{id}",
    tag = "Episodes",
    params(("id" = i64, Path, description = "剧集 ID")),
    responses(
        (status = 200, description = "删除成功", body = ApiResponse<serde_json::Value>),
        (status = 513, description = "剧集不存在", body = ApiResponse<serde_json::Value>),
    )
)]
pub async fn delete_episode(
    Path(id): Path<i64>,
    Extension(mode): Extension<DeleteMode>,
) -> Result<ApiResponse<()>, AppError> {
    let pool = db();
    crate::services::episodes_service::delete(pool, id, &mode.0).await?;
    Ok(ok_empty())
}

#[utoipa::path(
    post,
    path = "/api/v1/episodes/{id}/move",
    tag = "Episodes",
    params(("id" = i64, Path, description = "剧集 ID")),
    request_body = MoveEpisodeReq,
    responses(
        (status = 200, description = "移动成功（交换相邻的 level，返回移动后的剧集）", body = inline(ApiResponse<Episode>)),
        (status = 513, description = "已是首集或末集无法移动", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn move_episode(
    Path(id): Path<i64>,
    axum::Json(req): axum::Json<MoveEpisodeReq>,
) -> Result<ApiResponse<Episode>, AppError> {
    let pool = db();
    let row = crate::services::episodes_service::move_episode(pool, id, req.direction).await?;
    Ok(ok(row))
}

#[utoipa::path(
    post,
    path = "/api/v1/episodes/generate-by-prompt",
    tag = "Episodes",
    request_body = GenerateEpisodesByPromptReq,
    responses(
        (status = 200, description = "AI 生成完成并批量插入 project，返回剧集列表", body = inline(ApiResponse<Vec<Episode>>)),
        (status = 513, description = "参数缺失 / 无默认 text 后端 / AI JSON 解析失败", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn generate_by_prompt(
    axum::Json(req): axum::Json<GenerateEpisodesByPromptReq>,
) -> Result<ApiResponse<Vec<Episode>>, AppError> {
    let pool = db();
    use crate::services::ai_backends_service::AiCategory;
    let backend = crate::services::ai_client::pick_backend(
        pool,
        AiCategory::Text,
        req.ai_backend_id,
    )
    .await?;
    let prompt = crate::services::ai_prompter::build_by_prompt(&req, Some(&backend))?;
    let generated: Vec<crate::services::episodes_service::GeneratedEpisode> =
        crate::services::ai_client::chat_json_parsed_with_backend(
            &backend,
            &prompt.system,
            &prompt.user,
            Some(prompt.temperature),
            Some(prompt.max_tokens),
        )
        .await?;
    let pid = req.project_id;
    let created = crate::services::episodes_service::bulk_create(pool, pid, generated).await?;
    Ok(ok(created))
}

#[utoipa::path(
    post,
    path = "/api/v1/episodes/generate-by-import",
    tag = "Episodes",
    request_body = GenerateEpisodesByImportReq,
    responses(
        (status = 200, description = "AI 解析小说完成并批量插入 project，返回剧集列表", body = inline(ApiResponse<Vec<Episode>>)),
        (status = 513, description = "扩展名不支持 / 正文太短 / AI JSON 失败", body = inline(ApiResponse<serde_json::Value>)),
    )
)]
pub async fn generate_by_import(
    axum::Json(req): axum::Json<GenerateEpisodesByImportReq>,
) -> Result<ApiResponse<Vec<Episode>>, AppError> {
    let pool = db();
    use crate::services::ai_backends_service::AiCategory;
    let backend = crate::services::ai_client::pick_backend(
        pool,
        AiCategory::Text,
        req.ai_backend_id,
    )
    .await?;
    let prompt = crate::services::ai_prompter::build_by_import(&req, Some(&backend))?;
    let generated: Vec<crate::services::episodes_service::GeneratedEpisode> =
        crate::services::ai_client::chat_json_parsed_with_backend(
            &backend,
            &prompt.system,
            &prompt.user,
            Some(prompt.temperature),
            Some(prompt.max_tokens),
        )
        .await?;
    let pid = req.project_id;
    let created = crate::services::episodes_service::bulk_create(pool, pid, generated).await?;
    Ok(ok(created))
}

// ============================================================================
// 流式 SSE：每 3s 心跳保持连接；完成/失败时发 done/error 事件
// ============================================================================

#[derive(Debug, Serialize)]
struct HeartbeatData<'a> {
    elapsed_ms: u128,
    stage: &'a str,
    progress: Option<u8>,
}

#[derive(Debug, Serialize)]
struct ErrorData {
    code: String,
    message: String,
}

fn receiver_to_stream(rx: tokio::sync::mpsc::UnboundedReceiver<Event>) -> impl futures_util::Stream<Item = Result<Event, Infallible>> {
    UnboundedReceiverStream::new(rx).map(Ok)
}

async fn run_generate_stream<R>(
    req: R,
    mode_label: &'static str,
    build: impl FnOnce(&R, &crate::services::ai_backends_service::AiBackend) -> Result<crate::services::ai_prompter::EpisodesPrompt, AppError>
        + Send
        + 'static,
    project_id: i64,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>>
where
    R: RequireAiBackendId + Send + 'static,
{
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Event>();
    let stream = receiver_to_stream(rx);
    let sse = Sse::new(stream)
        .keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(5))
                .text("keep-alive"),
        );

    tokio::spawn(async move {
        let started = std::time::Instant::now();
        let pool = db();

        // 阶段 1：取后端 + 构造 prompt
        let backend = match crate::services::ai_client::pick_backend(
            pool,
            AiCategory::Text,
            req_backend_id(&req),
        )
        .await
        {
            Ok(b) => b,
            Err(e) => return emit_err(&tx, e),
        };

        if let Err(_e) = emit_heartbeat(&tx, started.elapsed().as_millis(), "prepare_prompt", None) {
            return;
        }
        let prompt = match build(&req, &backend) {
            Ok(p) => p,
            Err(e) => return emit_err(&tx, e),
        };

        // 阶段 2：调用 LLM（期间 3s 心跳）
        let call_fut = crate::services::ai_client::chat_json_parsed_with_backend::<
            Vec<GeneratedEpisode>,
        >(
            &backend, &prompt.system, &prompt.user, Some(prompt.temperature), Some(prompt.max_tokens)
        );
        let generated: Vec<GeneratedEpisode> = tokio::select! {
            res = call_fut => match res {
                Ok(v) => v,
                Err(e) => return emit_err(&tx, e),
            },
            _ = async {
                let mut count = 0u32;
                loop {
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    count += 1;
                    let progress = if count > 40 {
                        Some(98u8)
                    } else {
                        Some((count * 2).min(90) as u8)
                    };
                    if emit_heartbeat(&tx, started.elapsed().as_millis(), "calling_llm", progress).is_err() {
                        return; // 断开
                    }
                }
            } => unreachable!(),
        };

        // 阶段 3：入库
        if emit_heartbeat(&tx, started.elapsed().as_millis(), "bulk_create", Some(95)).is_err() {
            return;
        }
        let created = match crate::services::episodes_service::bulk_create(pool, project_id, generated).await {
            Ok(v) => v,
            Err(e) => return emit_err(&tx, e),
        };

        // 阶段 4：done 事件 —— 按 ApiResponse 信封发送
        let done_body = ApiResponse {
            code: ErrorCode::Ok.code(),
            success: true,
            message: format!("ok, {mode_label}, {}ms", started.elapsed().as_millis()),
            data: Some(created),
        };
        let json_str = match serde_json::to_string(&done_body) {
            Ok(s) => s,
            Err(e) => return emit_err(&tx, AppError::from_code_with_msg(ErrorCode::AiJsonParseFailed, format!("序列化失败: {e}"))),
        };
        let _ = tx.send(Event::default().event("done").data(json_str));

        fn emit_err(tx: &tokio::sync::mpsc::UnboundedSender<Event>, err: AppError) {
            let code = err.code.code();
            let msg = err.message;
            let data = match serde_json::to_string(&ErrorData { code: code.clone(), message: msg }) {
                Ok(s) => s,
                Err(e) => format!(r#"{{"code":"E99999","message":"{e}"}}"#),
            };
            let _ = tx.send(Event::default().event("error").data(data));
        }

        fn emit_heartbeat(
            tx: &tokio::sync::mpsc::UnboundedSender<Event>,
            elapsed_ms: u128,
            stage: &'static str,
            progress: Option<u8>,
        ) -> Result<(), ()> {
            let hb = HeartbeatData { elapsed_ms, stage, progress };
            let data = serde_json::to_string(&hb).unwrap_or_else(|_| format!(r#"{{"elapsed_ms":{elapsed_ms},"stage":"{stage}"}}"#));
            tx.send(Event::default().event("heartbeat").data(data)).map_err(|_| ())
        }
    });

    sse
}

// 从 req 里取 ai_backend_id：两个 DTO 都有该字段，用简单 trait 抽象
trait RequireAiBackendId {
    fn backend_id(&self) -> Option<i64>;
}
impl RequireAiBackendId for GenerateEpisodesByPromptReq {
    fn backend_id(&self) -> Option<i64> { self.ai_backend_id }
}
impl RequireAiBackendId for GenerateEpisodesByImportReq {
    fn backend_id(&self) -> Option<i64> { self.ai_backend_id }
}
fn req_backend_id<R: RequireAiBackendId>(r: &R) -> Option<i64> { r.backend_id() }

pub async fn generate_by_prompt_stream(
    Json(req): Json<GenerateEpisodesByPromptReq>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let pid = req.project_id;
    run_generate_stream(
        req,
        "by-prompt",
        |r, b| crate::services::ai_prompter::build_by_prompt(r, Some(b)),
        pid,
    ).await
}

pub async fn generate_by_import_stream(
    Json(req): Json<GenerateEpisodesByImportReq>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let pid = req.project_id;
    run_generate_stream(
        req,
        "by-import",
        |r, b| crate::services::ai_prompter::build_by_import(r, Some(b)),
        pid,
    ).await
}
