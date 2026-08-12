//! services 层：纯业务逻辑（handler 只处理入参校验 + 返回响应 envelope，具体业务丢这里）。
//! 未来按领域拆：config_service.rs / story_service.rs / job_service.rs / ai_service.rs ...

pub mod config_service;
