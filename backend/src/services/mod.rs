//! services 层：纯业务逻辑（handler 只处理入参校验 + 返回响应信封，具体业务丢这里）。
//! 未来按领域拆：project_service / story_service / job_service / ai_service ...

pub mod project_service;
pub mod ai_backends_service;
pub mod episodes_service;
pub mod ai_client;
pub mod ai_prompter;
