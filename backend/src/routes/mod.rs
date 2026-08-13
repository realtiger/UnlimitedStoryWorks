//! 路由总装：health + projects + swagger。

use axum::Router;

pub mod health;
pub mod projects;
pub mod swagger;

pub fn build_router() -> Router {
    Router::new()
        .merge(swagger::swagger_router())
        .merge(health::router())
        .merge(projects::router())
}
