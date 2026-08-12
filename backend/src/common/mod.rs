//! 通用基础设施模块。
//!
//! 对外只通过 `prelude` 统一导出当前**正在被调用**的高频符号；
//! 未被导出的 API（`ToAppError`、`ok_msg`、`err*` 系列、`status_teapot`、`with_msg`）
//! 等 step6/step7 真正用起来后再加进 prelude，避免 cargo dead_code 噪音。

pub mod error;
pub mod error_codes;
pub mod logging;
pub mod response;

pub mod prelude {
    pub use crate::common::error::AppError;
    pub use crate::common::error_codes::ErrorCode;
    pub use crate::common::response::{ApiResponse, ok, ok_empty};
}
