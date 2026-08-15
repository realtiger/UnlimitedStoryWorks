//! 统一的 AI 文本调用客户端：基于 ai_backends 的默认 text 后端做 OpenAI 兼容 chat completions。
//!
//! 设计：
//! - 优先取 category=text 且 is_default=true 的 active 后端配置；若没有则报错。
//! - 请求体为标准 OpenAI chat completions JSON：{ model, messages:[{role,content}],
//!   temperature, max_tokens, response_format:{type:"json_object"} }。
//! - 成功返回第一个 choice.message.content（纯字符串），由上层自行解析为 JSON。
//! - 超时/HTTP 429/非 2xx/鉴权失败 等都映射为 E07 号段错误码。

use once_cell::sync::Lazy;
use reqwest::{Client, StatusCode, header};
use serde::{Deserialize, Serialize};
use sqlx::AnyPool;

use crate::common::error_codes::ErrorCode;
use crate::services::ai_backends_service::{AiBackend, AiCategory};

static HTTP: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .user_agent(concat!("UnlimitedStoryWorks/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(std::time::Duration::from_secs(30))
        .timeout(std::time::Duration::from_secs(600))
        .pool_idle_timeout(std::time::Duration::from_secs(300))
        .tcp_keepalive(std::time::Duration::from_secs(30))
        .http1_title_case_headers()
        .build()
        .expect("reqwest client build")
});

fn err(code: ErrorCode, msg: impl Into<String>) -> crate::common::error::AppError {
    crate::common::error::AppError::from_code_with_msg(code, msg)
}

// ---------------------------------------------------------------------------
// OpenAI chat completions wire types（最小必需字段，仅用于序列化/反序列化）
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
struct ChatMessage<'a> {
    role: &'static str,
    content: &'a str,
}

#[derive(Debug, Clone, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Debug, Clone, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    typ: &'static str,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatChoice {
    message: ChatMessageOut,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatMessageOut {
    #[allow(dead_code)]
    role: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    #[allow(dead_code)]
    usage: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExpectOutput {
    /// 期望返回纯文本（保留给未来非 JSON 调用使用）
    #[allow(dead_code)]
    Plain,
    /// 期望返回 JSON，并在请求体中显式加 response_format=json_object
    Json,
}

/// 按 category 取默认后端（要求 is_default=true, status=active）。
pub async fn pick_default_backend(
    pool: &AnyPool,
    category: AiCategory,
) -> Result<AiBackend, crate::common::error::AppError> {
    let list = crate::services::ai_backends_service::list(
        pool,
        crate::services::ai_backends_service::ListAiBackendsQuery {
            category: Some(category),
            keyword: None,
            limit: Some(50),
            offset: Some(0),
        },
    )
    .await?;
    let def = list.into_iter().find(|b| b.is_default);
    match def {
        Some(b) => Ok(b),
        None => Err(err(
            ErrorCode::AiBackendMissing,
            format!(
                "未找到「{category}」类型的默认 AI 后端配置，请先在 AI 配置中添加并设为默认"
            ),
        )),
    }
}

/// 取后端：如果传入具体 ai_backend_id，按 id 取（校验 category 匹配、status=active）；
/// 否则取对应 category 的默认后端。返回 (backend, category_clone)。
pub async fn pick_backend(
    pool: &AnyPool,
    require_category: AiCategory,
    id: Option<i64>,
) -> Result<AiBackend, crate::common::error::AppError> {
    match id {
        Some(bid) => {
            let b = crate::services::ai_backends_service::get_by_id(pool, bid).await?;
            if b.category != require_category {
                return Err(err(
                    ErrorCode::AiBackendCategoryInvalid,
                    format!(
                        "该 AI 后端类型为 {}，与本次调用所需类型 {require_category} 不匹配",
                        b.category
                    ),
                ));
            }
            Ok(b)
        }
        None => pick_default_backend(pool, require_category).await,
    }
}

/// 一次完整的文本 chat completions 调用：调用方通过 pick_backend / pick_default_backend 传入具体后端。
pub async fn chat_json_with_backend(
    backend: &AiBackend,
    system_prompt: &str,
    user_prompt: &str,
    expect: ExpectOutput,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<String, crate::common::error::AppError> {
    let base = backend.base_url.trim().trim_end_matches('/').to_string();
    let url = if base.ends_with("/chat/completions") {
        base
    } else if base.ends_with("/v1") {
        format!("{base}/chat/completions")
    } else {
        format!("{base}/v1/chat/completions")
    };

    let cleaned_api_key: String = backend
        .api_key
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();

    let messages = vec![
        ChatMessage { role: "system", content: system_prompt },
        ChatMessage { role: "user", content: user_prompt },
    ];

    let body = ChatRequest {
        model: backend.model_name.as_str(),
        messages,
        temperature,
        max_tokens,
        response_format: match expect {
            ExpectOutput::Json => Some(ResponseFormat { typ: "json_object" }),
            ExpectOutput::Plain => None,
        },
    };

    let req = HTTP
        .post(&url)
        .header(header::AUTHORIZATION, format!("Bearer {}", cleaned_api_key))
        .header(header::CONTENT_TYPE, "application/json")
        .json(&body);

    tracing::debug!(target: "usw::ai::call", backend=?backend.name, url=%url, model=%backend.model_name, "sending chat completions");

    let resp = req
        .send()
        .await
        .map_err(|e| err(ErrorCode::AiRequestFailed, format!("AI 请求发送失败：{e}")))?;

    let status = resp.status();
    if !status.is_success() {
        let code = match status {
            StatusCode::TOO_MANY_REQUESTS => ErrorCode::AiRateLimited,
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => ErrorCode::AiAuthFailed,
            StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => ErrorCode::AiTimeout,
            _ => ErrorCode::AiBadStatus,
        };
        let text = resp
            .text()
            .await
            .unwrap_or_else(|_| "(读取响应体失败)".to_string());
        let preview = text.chars().take(400).collect::<String>();
        return Err(err(
            code,
            format!("AI 推理后端返回 HTTP {}：{}", status.as_u16(), preview),
        ));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| err(ErrorCode::AiBadFormat, format!("解析 AI 响应 JSON 失败：{e}")))?;

    let first_content = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .unwrap_or_default();

    if matches!(expect, ExpectOutput::Json) && first_content.trim().is_empty() {
        return Err(err(ErrorCode::AiJsonParseFailed, "AI 返回的 JSON 内容为空"));
    }
    Ok(first_content)
}

/// 一次完整的文本 chat completions 调用（默认取 text 类默认后端，保留给未来其他模块）。
#[allow(dead_code)]
pub async fn chat_json(
    pool: &AnyPool,
    system_prompt: &str,
    user_prompt: &str,
    expect: ExpectOutput,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<String, crate::common::error::AppError> {
    let backend = pick_default_backend(pool, AiCategory::Text).await?;
    chat_json_with_backend(&backend, system_prompt, user_prompt, expect, temperature, max_tokens)
        .await
}

/// 便利函数：带具体后端的 chat_json + 反序列化成 T（最常用）。
pub async fn chat_json_parsed_with_backend<T: serde::de::DeserializeOwned>(
    backend: &AiBackend,
    system_prompt: &str,
    user_prompt: &str,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<T, crate::common::error::AppError> {
    let raw = chat_json_with_backend(
        backend,
        system_prompt,
        user_prompt,
        ExpectOutput::Json,
        temperature,
        max_tokens,
    )
    .await?;
    let cleaned = clean_jsonish(&raw);
    serde_json::from_str::<T>(&cleaned).map_err(|e| {
        let snippet = cleaned.chars().take(400).collect::<String>();
        err(
            ErrorCode::AiJsonParseFailed,
            format!("AI 返回 JSON 反序列化失败：{e}，片段：{snippet}"),
        )
    })
}

#[allow(dead_code)]
pub async fn chat_json_parsed<T: serde::de::DeserializeOwned>(
    pool: &AnyPool,
    system_prompt: &str,
    user_prompt: &str,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<T, crate::common::error::AppError> {
    let backend = pick_default_backend(pool, AiCategory::Text).await?;
    chat_json_parsed_with_backend::<T>(
        &backend,
        system_prompt,
        user_prompt,
        temperature,
        max_tokens,
    )
    .await
}

/// 粗暴但高成功率的 JSON 清理：
/// 1. 如果有 ```json ... ``` 代码块，取最内层内容
/// 2. 否则找第一个 `[` 或 `{` 到最后一个 `]` 或 `}` 之间的子串
pub fn clean_jsonish(s: &str) -> String {
    let s = s.trim();
    // 1. 代码块兜底
    if let (Some(start), Some(end)) = (s.find("```json"), s.rfind("```")) {
        let mid = &s[start + 7..end];
        return mid.trim().to_string();
    }
    if let (Some(start), Some(end)) = (s.find("```"), s.rfind("```")) {
        let after = start + 3;
        if after < end {
            let mid = &s[after..end];
            return mid.trim().to_string();
        }
    }
    // 2. 数组或对象兜底
    let open_bracket = s.find('[').unwrap_or(s.len());
    let open_brace = s.find('{').unwrap_or(s.len());
    let open_idx = open_bracket.min(open_brace);
    let close_bracket = s.rfind(']').unwrap_or(0);
    let close_brace = s.rfind('}').unwrap_or(0);
    let close_idx = close_bracket.max(close_brace);
    if open_idx < close_idx + 1 {
        return s[open_idx..close_idx + 1].to_string();
    }
    s.to_string()
}
