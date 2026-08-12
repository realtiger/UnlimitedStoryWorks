//! OpenAPI / Swagger UI 挂载：/swagger-ui + /openapi.json

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::config::model::{AppConfig, CorsConfig, LoggingConfig, ServerConfig, SiteFeature, SiteInfoConfig};
use crate::routes::app::ErrorDemoQuery;

/// utoipa 总集合类型：把所有 paths / schemas 登记在这里
///
/// 被 `paths(...)` 引用的 handler 必须满足：
/// - 函数上方有 `#[utoipa::path]` 宏
/// - 函数声明为 `pub async fn`（默认私有会让宏生成的 `__path_xxx` 不可见）
/// - 路径写**全绝对路径** `crate::xxx::yyy`，避免跨模块 `use` 带来的可见性问题
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Unlimited Story Works Backend",
        version = "0.1.0",
        description = "Unlimited Story Works / 无限绘卷后端 API
- 成功响应：HTTP **200** + success=true + code=`S00000`
- 错误响应：HTTP **513** I'm a Teapot (RFC 2324) + success=false + code=`E{类别2位}{序号3位}`",
        contact(name = "Unlimited Story Works Team"),
        license(name = "Internal Use Only")
    ),
    paths(
        crate::routes::app::root,
        crate::routes::health::health,
        crate::routes::app::get_config,
        crate::routes::app::get_site_info,
        crate::routes::app::error_demo,
    ),
    components(schemas(
        AppConfig, ServerConfig, CorsConfig, SiteInfoConfig, SiteFeature, LoggingConfig,
        ErrorDemoQuery
    )),
    tags(
        (name = "Meta",   description = "元信息：根路径 / 健康检查 / 站点头信息"),
        (name = "System", description = "系统：配置读取 / 错误演示接口（dev only）")
    ),
    servers(
        (url = "http://127.0.0.1:5000", description = "本地开发默认"),
        (url = "http://0.0.0.0:5000",   description = "对外监听（开发环境）"),
    )
)]
pub struct ApiDoc;

/// 合并：Swagger UI 页面 + 原始 JSON schema
///
/// - `GET /openapi.json`：给 Postman / Insomnia / 前端代码生成器直接导入
/// - `GET /swagger-ui/` ：浏览器交互式 UI（缺 `/` 也能访问，会自动 301 跳转）
///
/// 注：`SwaggerUi::new(...).url("/openapi.json", ...)` 会自动挂载 `/openapi.json`，
///     所以不需要再额外 `.route()` 加 /openapi.json`，否则 "Overlapping method route` panic。
pub fn swagger_router() -> Router {
    let openapi = ApiDoc::openapi();
    Router::new().merge(SwaggerUi::new("/swagger-ui").url("/openapi.json", openapi))
}
