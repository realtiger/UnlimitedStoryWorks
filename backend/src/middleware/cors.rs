//! CORS 中间件：从 CorsConfig 构建 tower-http CorsLayer。

use std::time::Duration;

use axum::http::{HeaderValue, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::config::model::CorsConfig;

/// 根据 CorsConfig 构建 CorsLayer。
pub fn cors_layer(cfg: &CorsConfig) -> CorsLayer {
    let origin = if cfg.allow_any_origin {
        AllowOrigin::any()
    } else {
        let origins: Vec<HeaderValue> = cfg
            .allow_origins
            .iter()
            .filter_map(|s| s.parse().ok())
            .collect();
        AllowOrigin::list(origins)
    };

    let methods: Vec<Method> = cfg
        .allow_methods
        .iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    let headers: Vec<axum::http::HeaderName> = cfg
        .allow_headers
        .iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    let mut layer = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods(methods)
        .allow_headers(headers)
        .max_age(Duration::from_secs(cfg.max_age_secs));

    if cfg.allow_credentials {
        layer = layer.allow_credentials(true);
    }

    layer
}
