//! common 层：错误/响应/日志/工具函数 —— 任何业务都能用。
//!
//! 对外只通过 `prelude` 统一导出当前**正在被调用**的高频符号，
//! 其它用到再加，避免 dead_code 噪音。

pub mod error;
pub mod error_codes;
pub mod logging;
pub mod response;

pub mod prelude {
    pub use crate::common::error::AppError;
    pub use crate::common::response::{ApiResponse, ok, ok_empty};
}