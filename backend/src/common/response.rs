//! 统一响应信封：{ code, success, message, data }
//!
//! 约定：
//! - 成功响应：HTTP **200**  + success=true,  code=S00000
//! - 错误响应：HTTP **513**  + success=false, code=Exxxxx（具体见 error_codes.rs）
//!   （RFC 2324 "我是个茶壶"，需求明确要求。）

use axum::{
    http::{HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::common::error_codes::ErrorCode;

/// 标准响应体（四字段信封）
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiResponse<T> {
    #[schema(example = "S00000")]
    pub code: String,
    #[schema(example = "true")]
    pub success: bool,
    #[schema(example = "ok")]
    #[serde(default)]
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

/// HTTP 513 I'm a Teapot —— Rust 没有对应常量，自己构造一个 fn 即可（const 里不能 unwrap）
pub fn status_teapot() -> StatusCode {
    StatusCode::from_u16(513).expect("513 是合法 HTTP 状态码")
}

// ---------------------------------------------------------------------------
// 构造成功 / 失败响应的便捷函数
// ---------------------------------------------------------------------------

/// 成功：`{code:S00000, success:true, message:"ok", data: Some(value)}`
pub fn ok<T: Serialize>(value: T) -> ApiResponse<T> {
    ApiResponse {
        code: ErrorCode::Ok.code(),
        success: true,
        message: "ok".into(),
        data: Some(value),
    }
}

/// 成功但 data 为空（比如 DELETE 不需要返回 body）
pub fn ok_empty() -> ApiResponse<()> {
    ApiResponse {
        code: ErrorCode::Ok.code(),
        success: true,
        message: "ok".into(),
        data: None,
    }
}

/// 错误 + 自定义信息（比如"字段 password 长度不足 8"）
pub fn err_msg<T: Serialize>(code: ErrorCode, message: impl Into<String>) -> ApiResponse<T> {
    ApiResponse { code: code.code(), success: false, message: message.into(), data: None }
}

/// 错误 + 自定义信息 + 附带 data（比如校验失败时返回具体哪几个字段错了）
pub fn err_with_data<T: Serialize>(code: ErrorCode, message: impl Into<String>, data: T) -> ApiResponse<T> {
    ApiResponse {
        code: code.code(),
        success: false,
        message: message.into(),
        data: Some(data),
    }
}

// ---------------------------------------------------------------------------
// IntoResponse：按 success 决定 HTTP 200 / 513
// ---------------------------------------------------------------------------

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let status = if self.success { StatusCode::OK } else { status_teapot() };
        let body = match serde_json::to_vec(&self) {
            Ok(v) => v,
            Err(e) => {
                // 兜底：序列化失败时手动拼一段 JSON，保证至少能把错误返回出去
                let fallback = format!(
                    r#"{{"code":"{}","success":false,"message":"响应序列化失败: {}","data":null}}"#,
                    ErrorCode::Unknown.code(),
                    e,
                );
                fallback.into_bytes()
            }
        };

        let mut res = Response::new(body.into());
        *res.status_mut() = status;
        res.headers_mut().insert(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json; charset=utf-8"),
        );
        res
    }
}
