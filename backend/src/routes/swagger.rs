//! OpenAPI / Swagger UI 挂载：/swagger-ui + /openapi.json
//!
//! 现在仅包含两类接口：
//!   - Meta    : /health
//!   - Projects: GET/POST/PUT/DELETE /api/v1/projects
//! 不再包含 demo 用的 /config / /site-info / /error-demo。

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::services::project_service::{
    CommonFields, CreateProjectReq, ListProjectsQuery, Project, UpdateProjectReq,
};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Unlimited Story Works Backend",
        version = "0.1.0",
        description = "Unlimited Story Works Backend API. 
Response envelope: HTTP 200 success=true code=S00000; HTTP 513 success=false code=Exxxxxx",
        contact(name = "Unlimited Story Works Team"),
        license(name = "MIT")
    ),
    paths(
        crate::routes::health::health,
        crate::routes::projects::list_projects,
        crate::routes::projects::get_project,
        crate::routes::projects::create_project,
        crate::routes::projects::update_project,
    ),
    components(schemas(
        CommonFields,
        Project,
        CreateProjectReq,
        UpdateProjectReq,
        ListProjectsQuery,
    )),
    tags(
        (name = "Meta",     description = "Meta endpoints: health probe"),
        (name = "Projects", description = "Project resource: root container of all future business resources")
    ),
    servers(
        (url = "http://127.0.0.1:5000", description = "local dev default"),
        (url = "http://0.0.0.0:5000",   description = "listen all (dev)"),
    )
)]
pub struct ApiDoc;

pub fn swagger_router() -> Router {
    let openapi = ApiDoc::openapi();
    Router::new().merge(SwaggerUi::new("/swagger").url("/openapi.json", openapi))
}
