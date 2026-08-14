//! 路由总装：health + projects + swagger + 中间件层。

use axum::Router;

use crate::config::model::AppConfig;
use crate::middleware::{cors, delete_mode};

pub mod health;
pub mod projects;
pub mod swagger;

pub fn build_router(cfg: &AppConfig) -> Router {
    Router::new()
        .merge(swagger::swagger_router())
        .merge(health::router())
        .merge(projects::router())
        .layer(delete_mode::delete_mode_layer("soft"))
        .layer(cors::cors_layer(&cfg.cors()))
}
