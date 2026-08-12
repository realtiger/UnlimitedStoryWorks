//! 路由总装：按业务分子模块（app / health / story / job ...）。
//!
//! 未来业务路由每新增一个 domain，只要 `pub mod xxx` + 下面 `merge(xxx::router())`，
//! main.rs 不需要再改。

use axum::Router;

pub mod app;
pub mod health;
pub mod swagger;

/// 组装所有路由（返回最终 Router，main.rs 直接拿去 serve）
///
/// `swagger_router` 单独放在最前面：它自己也带 `/openapi.json` + `/swagger-ui`
/// 两条路由，和业务路径互不冲突。
pub fn build_router() -> Router {
    Router::new()
        .merge(swagger::swagger_router())
        .merge(health::router())
        .merge(app::router())
}
