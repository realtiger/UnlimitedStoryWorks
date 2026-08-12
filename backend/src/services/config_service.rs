//! 配置相关 service：对外暴露结构化的视图 DTO，而不是直接泄漏整个 AppConfig。
//! （当前 demo 阶段先直接克隆 AppConfig，后续可以按字段权限裁剪。）

use crate::common::prelude::*;
use crate::config::{cfg, cfg_arc, AppConfig, SiteInfoConfig};

/// 返回完整配置（设置页面读取用）
pub fn get_full_config() -> Result<AppConfig, AppError> {
    // 直接 clone 单例。如果未来字段很多且有需要裁剪的敏感信息（secret key），
    // 在这里构造一个独立 DTO 再返回。
    Ok(cfg().clone())
}

/// 只返回站点信息（首页/SEO/Header 展示用，payload 更小）
pub fn get_site_info() -> Result<SiteInfoConfig, AppError> {
    Ok(cfg_arc().site_info.clone())
}

/// 故意触发 4 种错误类型的测试函数（供 /api/v1/error-demo?kind=xxx 调用）。
pub fn trigger_demo_error(kind: &str) -> Result<(), AppError> {
    match kind {
        "invalid_param" => Err(AppError::new(
            ErrorCode::InvalidParam,
            "password 长度不得少于 8 位",
        )),
        "anyhow" => Err(AppError::from(anyhow::anyhow!(
            "演示：anyhow! 宏抛出的错误 → AppError 通过 From 自动包装"
        ))),
        "serde_json" => {
            // 故意构造一段非法 JSON，让 ? 触发 From<serde_json::Error>
            let _: serde_json::Value = serde_json::from_str("{not json!!!")?;
            Ok(())
        }
        "config_load" => Err(AppError::from_code(ErrorCode::ConfigLoad)),
        other => Err(AppError::new(
            ErrorCode::InvalidParam,
            format!("未知 kind={other:?}，可用：invalid_param / anyhow / serde_json / config_load"),
        )),
    }
}