//! 删除模式中间件：通过 Extension 注入 DeleteMode，后期可替换为 auth 中间件动态注入。

use axum::Extension;

/// 删除模式：soft = 软删，hard = 物理删除。
#[derive(Clone, Debug)]
pub struct DeleteMode(pub String);

/// 创建 DeleteMode Extension layer。
pub fn delete_mode_layer(mode: &str) -> Extension<DeleteMode> {
    Extension(DeleteMode(mode.to_string()))
}
