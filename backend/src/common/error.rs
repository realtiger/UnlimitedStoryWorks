//! AppError：把任何错误（anyhow / serde / std::io 等）统一包装成
//! `{ success:false, code, message, data }` + **HTTP 513** 响应。

use std::fmt;

use axum::response::IntoResponse;
use thiserror::Error;

use super::error_codes::ErrorCode;
use super::response::{ApiResponse, err_with_data, err_msg, status_teapot};

#[derive(Debug, Error)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub source: anyhow::Error,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code.code(), self.message)?;
        let src = format!("{:#}", self.source);
        if !src.is_empty() {
            write!(f, "\n  caused by: {src}")?;
        }
        Ok(())
    }
}

impl AppError {
    pub fn new(code: ErrorCode, msg: impl Into<String>) -> Self {
        Self { code, message: msg.into(), source: anyhow::anyhow!("") }
    }
    pub fn from_code_with_msg(code: ErrorCode, msg: impl Into<String>) -> Self {
        let msg_s = msg.into();
        Self { code, message: msg_s.clone(), source: anyhow::anyhow!("{msg_s}") }
    }
    pub fn with_src<E: Into<anyhow::Error>>(mut self, src: E) -> Self {
        self.source = src.into(); self
    }
}
// -------- 常见错误类型：? 自动上升（From）
impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        AppError::new(ErrorCode::Unknown, value.to_string()).with_src(value)
    }
}
impl From<serde_json::Error> for AppError {
    fn from(v: serde_json::Error) -> Self {
        let msg = v.to_string();
        AppError { code: ErrorCode::InvalidJson, message: msg.clone(), source: anyhow::Error::new(v) }
    }
}
impl From<serde_yaml::Error> for AppError {
    fn from(v: serde_yaml::Error) -> Self {
        let msg = v.to_string();
        AppError { code: ErrorCode::ConfigInvalid, message: msg.clone(), source: anyhow::Error::new(v) }
    }
}
impl From<std::io::Error> for AppError {
    fn from(v: std::io::Error) -> Self {
        let msg = v.to_string();
        AppError { code: ErrorCode::FileWriteFailed, message: msg.clone(), source: anyhow::Error::new(v) }
    }
}
impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        // 按错误类型分级打 warn / error
        use ErrorCode::*;
        let code_str = self.code.code();
        let source = format!("{:#}", self.source);

        // 客户端可见的 message：优先使用自定义 message，否则用 ErrorCode 默认中文
        let user_message = if self.message.trim().is_empty() {
            self.code.default_message()
        } else {
            self.message.clone()
        };

        // 给 tracing 用的一行摘要（避免多行 "\n caused by:" 破坏日志文件格式）
        let summary_source = if source.is_empty() || source == user_message {
            String::new()
        } else {
            // 换行换成 " | " 保证一行一条（方便 grep / 正则 / JSON 采集）
            source.split('\n').collect::<Vec<_>>().join(" | ")
        };

        let is_warn = matches!(
            self.code,
            InvalidJson | InvalidParam | InvalidQuery | InvalidForm
            | Unauthorized | PermissionDenied | TokenInvalid | OriginCheckFailed
            | ProjectNotFound | ProjectNameInvalid | ProjectSlugDuplicated | ProjectBadState
            | StoryNotFound | JobNotFound | FileNotFound | FileTooLarge | FileTypeNotAllowed
            | EmptyResult
        );

        if is_warn {
            if summary_source.is_empty() {
                tracing::warn!(
                    target: "usw::error",
                    error_code = %code_str,
                    error_message = %user_message,
                    "http error (client)"
                );
            } else {
                tracing::warn!(
                    target: "usw::error",
                    error_code = %code_str,
                    error_message = %user_message,
                    source = %summary_source,
                    "http error (client)"
                );
            }
        } else {
            if summary_source.is_empty() {
                tracing::error!(
                    target: "usw::error",
                    error_code = %code_str,
                    error_message = %user_message,
                    "http error (server)"
                );
            } else {
                tracing::error!(
                    target: "usw::error",
                    error_code = %code_str,
                    error_message = %user_message,
                    source = %summary_source,
                    "http error (server)"
                );
            }
        }

        let resp: ApiResponse<serde_json::Value> = {
            if source.is_empty() {
                err_msg(self.code, user_message)
            } else {
                err_with_data(
                    self.code,
                    user_message,
                    serde_json::json!({ "detail": source }),
                )
            }
        };

        let body = serde_json::to_vec(&resp).unwrap_or_else(|e| {
            format!(
                r#"{{"code":"{}","success":false,"message":"{}","data":null}}"#,
                ErrorCode::Unknown.code(), e
            )
            .into_bytes()
        });

        let mut r = axum::response::Response::new(body.into());
        *r.status_mut() = status_teapot();
        r.headers_mut().insert(
            axum::http::header::CONTENT_TYPE,
            axum::http::HeaderValue::from_static("application/json; charset=utf-8"),
        );
        r
    }
}
