//! 错误码字典：统一 `E{类别2位}{序号3位}` 格式。
//!
//! 通过 code() 拿到形如 "S00000"（成功）或 "E00001"（错误）的字符串，
//! 通过 default_message() 拿到默认中文说明，通过 thiserror 的注释直接查看含义。

use thiserror::Error;

// ---------------------------------------------------------------------------
// 总类别编号（便于查表）
// ---------------------------------------------------------------------------
// E00_xxx = 通用 / 系统
// E01_xxx = 参数 / 输入校验
// E02_xxx = 认证 / 权限
// E03_xxx = 配置 / 启动
// E04_xxx = 业务 - 剧本/剧集
// E05_xxx = 业务 - 任务/JOB
// E06_xxx = 业务 - 文件/上传
// E07_xxx = 业务 - AI 调用
// E08_xxx = 第三方 / 外部依赖
// ---------------------------------------------------------------------------

#[allow(dead_code)]
#[derive(Debug, Error, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCode {
    // ===== 00 通用 =====
    /// 通用成功（不会作为错误抛出，仅 code() 占位）
    #[error("成功")]
    Ok,
    /// 兜底通用错误，没有更精确的分类时使用
    #[error("通用内部错误")]
    Unknown,
    /// 预留字段，用于 "请求已处理但返回空结果" 类语义
    #[error("空结果")]
    EmptyResult,

    // ===== 01 参数 / 输入 =====
    /// Json body 反序列化失败（字段缺失 / 类型不匹配）
    #[error("请求体 JSON 解析失败")]
    InvalidJson,
    /// Query 参数 / Path 参数 校验不通过
    #[error("请求参数不合法")]
    InvalidParam,
    /// 查询条件表达式有问题（如分页越界、排序字段不在白名单）
    #[error("查询条件不合法")]
    InvalidQuery,
    /// multipart 表单 / 纯字段校验错误
    #[error("表单字段校验失败")]
    InvalidForm,

    // ===== 02 认证 / 权限 =====
    /// 未登录 / 没有 Authorization header
    #[error("未登录或登录已过期")]
    Unauthorized,
    /// 已登录但角色不允许访问
    #[error("权限不足")]
    PermissionDenied,
    /// Authorization header 有值但 token 解析失败/签名错误/过期
    #[error("Token 无效")]
    TokenInvalid,
    /// CSRF / Origin 校验失败
    #[error("来源校验失败")]
    OriginCheckFailed,

    // ===== 03 配置 / 启动 =====
    /// config.yaml 不存在、字段缺失、YAML 语法错误
    #[error("配置文件加载或解析失败")]
    ConfigLoad,
    /// 配置字段值不符合约束（端口=0、logging.target 不在 enum 中）
    #[error("配置校验失败")]
    ConfigInvalid,
    /// 进程内 OnceCell 单例被重复 install
    #[error("配置重复安装")]
    ConfigAlreadyInstalled,
    /// AI 后端配置不存在或已被软删除
    #[error("AI 后端配置不存在")]
    AiBackendNotFound,
    /// AI 后端配置 name 在同 category 下重复
    #[error("AI 后端配置名称已存在")]
    AiBackendNameDuplicated,
    /// AI 后端 category 不在白名单（text/image/video/audio/embedding）
    #[error("AI 后端类型不合法")]
    AiBackendCategoryInvalid,
    /// AI 后端必填字段为空（name/base_url/model_name/api_key）
    #[error("AI 后端配置字段不完整")]
    AiBackendFieldsMissing,

    // ===== 04 业务 - Project / 剧本 / 剧集 =====
    #[error("项目不存在")]
    ProjectNotFound,
    #[error("项目名称无效（空或超过 120 字符）")]
    ProjectNameInvalid,
    #[error("项目 Slug 已存在")]
    ProjectSlugDuplicated,
    #[error("项目状态不允许当前操作")]
    ProjectBadState,
    #[error("剧本不存在")]
    StoryNotFound,
    #[error("剧本名称重复")]
    StoryDuplicated,
    #[error("剧本状态不允许当前操作")]
    StoryBadState,
    #[error("分镜不存在")]
    SceneNotFound,
    #[error("角色不存在")]
    CharacterNotFound,
    /// 剧集不存在或已被软删除
    #[error("剧集不存在")]
    EpisodeNotFound,
    /// 剧集标题为空或超长
    #[error("剧集标题不合法")]
    EpisodeTitleInvalid,
    /// 在 project 范围内 move 方向不合法（首集上移、末集下移等）
    #[error("剧集移动方向不合法")]
    EpisodeBadMove,
    /// Project 下生成剧集时 outline/style/genre/count 等必填字段缺失
    #[error("剧集生成参数不完整")]
    EpisodeGenerateMissing,
    /// generate count 超出允许范围（1-100）
    #[error("剧集生成数量超出范围")]
    EpisodeGenerateCountBad,
    /// 导入小说全文为空或长度超限
    #[error("导入小说内容不合法")]
    EpisodeImportContentBad,
    /// 导入小说扩展名/类型不在白名单
    #[error("导入小说文件类型不支持")]
    EpisodeImportTypeBad,
    /// 上下移动时找不到相邻剧集（竞态/已删除）
    #[error("剧集排序失败")]
    EpisodeReorderFailed,

    // ===== 05 业务 - 任务 / JOB =====
    #[error("任务不存在")]
    JobNotFound,
    #[error("任务状态不允许当前操作（比如重复排队已在运行的任务）")]
    JobBadState,
    #[error("任务取消失败")]
    JobCancelFailed,
    #[error("任务进度查询失败")]
    JobProgressError,

    // ===== 06 业务 - 文件 / 上传 =====
    #[error("文件过大")]
    FileTooLarge,
    #[error("文件类型不支持")]
    FileTypeNotAllowed,
    #[error("文件不存在")]
    FileNotFound,
    #[error("文件写入失败（磁盘满 / 权限）")]
    FileWriteFailed,

    // ===== 07 业务 - AI 调用 =====
    #[error("AI 模型调用请求被限流")]
    AiRateLimited,
    #[error("AI 模型响应超时")]
    AiTimeout,
    #[error("AI 模型返回内容不符合格式约定")]
    AiBadFormat,
    #[error("AI 模型鉴权失败（API Key 缺失 / 错误）")]
    AiAuthFailed,
    /// 未找到某 AI 类型的默认后端（比如生成剧本需要 text 默认后端但没配置）
    #[error("未配置可用的 AI 推理后端")]
    AiBackendMissing,
    /// AI 请求发送失败（网络错误 / DNS / 连接被拒）
    #[error("AI 请求发送失败")]
    AiRequestFailed,
    /// AI 返回 HTTP 非 2xx（500/404/429 等，限流在单独 E07_001）
    #[error("AI 推理后端返回错误状态码")]
    AiBadStatus,
    /// 从 AI 返回文本中解析 JSON 失败（内容不是合法 JSON）
    #[error("AI 返回 JSON 解析失败")]
    AiJsonParseFailed,

    // ===== 08 外部依赖 =====
    #[error("数据库错误")]
    DatabaseError,
    #[error("数据库查询或写入失败")]
    DatabaseQueryError,
    #[error("数据库约束冲突（唯一键/外键）")]
    DatabaseConstraint,
    #[error("对象存储 (S3 / OSS) 错误")]
    ObjectStorageError,
    #[error("消息队列错误")]
    MqError,
    #[error("GPU / 渲染节点错误")]
    RenderNodeError,
}

impl ErrorCode {
    /// 返回状态码字符串：
    /// - 成功类：`S{NNNNN}` （S = Success，直观区分错误）
    /// - 错误类：`E{NNNNN}` （E = Error）
    pub fn code(self) -> String {
        use ErrorCode::*;
        let (prefix, n): (&str, u32) = match self {
            Ok => ("S", 00_000),

            Unknown => ("E", 00_001),
            EmptyResult => ("E", 00_002),

            InvalidJson => ("E", 01_001),
            InvalidParam => ("E", 01_002),
            InvalidQuery => ("E", 01_003),
            InvalidForm => ("E", 01_004),

            Unauthorized => ("E", 02_001),
            PermissionDenied => ("E", 02_002),
            TokenInvalid => ("E", 02_003),
            OriginCheckFailed => ("E", 02_004),

            ConfigLoad => ("E", 03_001),
            ConfigInvalid => ("E", 03_002),
            ConfigAlreadyInstalled => ("E", 03_003),
            AiBackendNotFound => ("E", 03_004),
            AiBackendNameDuplicated => ("E", 03_005),
            AiBackendCategoryInvalid => ("E", 03_006),
            AiBackendFieldsMissing => ("E", 03_007),

            // ===== 04 业务 - Project / 剧集 =====
            ProjectNotFound => ("E", 04_001),
            ProjectNameInvalid => ("E", 04_002),
            ProjectSlugDuplicated => ("E", 04_003),
            ProjectBadState => ("E", 04_004),
            StoryNotFound => ("E", 04_011),
            StoryDuplicated => ("E", 04_012),
            StoryBadState => ("E", 04_013),
            SceneNotFound => ("E", 04_014),
            CharacterNotFound => ("E", 04_015),
            EpisodeNotFound => ("E", 04_021),
            EpisodeTitleInvalid => ("E", 04_022),
            EpisodeBadMove => ("E", 04_023),
            EpisodeGenerateMissing => ("E", 04_024),
            EpisodeGenerateCountBad => ("E", 04_025),
            EpisodeImportContentBad => ("E", 04_026),
            EpisodeImportTypeBad => ("E", 04_027),
            EpisodeReorderFailed => ("E", 04_028),

            JobNotFound => ("E", 05_001),
            JobBadState => ("E", 05_002),
            JobCancelFailed => ("E", 05_003),
            JobProgressError => ("E", 05_004),

            FileTooLarge => ("E", 06_001),
            FileTypeNotAllowed => ("E", 06_002),
            FileNotFound => ("E", 06_003),
            FileWriteFailed => ("E", 06_004),

            AiRateLimited => ("E", 07_001),
            AiTimeout => ("E", 07_002),
            AiBadFormat => ("E", 07_003),
            AiAuthFailed => ("E", 07_004),
            AiBackendMissing => ("E", 07_005),
            AiRequestFailed => ("E", 07_006),
            AiBadStatus => ("E", 07_007),
            AiJsonParseFailed => ("E", 07_008),

            // ===== 08 外部依赖 =====
            // ===== 08_001 - 08_003 数据库 =====
            DatabaseError => ("E", 08_001),
            DatabaseQueryError => ("E", 08_002),
            DatabaseConstraint => ("E", 08_003),
            ObjectStorageError => ("E", 08_004),
            MqError => ("E", 08_005),
            RenderNodeError => ("E", 08_006),
        };
        format!("{prefix}{n:05}")
    }

    /// 返回默认中文信息（handler 没自定义 message 时用这个兜底）
    pub fn default_message(self) -> String {
        // 直接复用 thiserror 的 Display
        self.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_unique() {
        // 通过 code() 转字符串再收集进集合，保证 5 位编码没有重复
        use std::collections::HashSet;
        use ErrorCode::*;
        let all = [
            Ok, Unknown, EmptyResult,
            InvalidJson, InvalidParam, InvalidQuery, InvalidForm,
            Unauthorized, PermissionDenied, TokenInvalid, OriginCheckFailed,
            ConfigLoad, ConfigInvalid, ConfigAlreadyInstalled,
            AiBackendNotFound, AiBackendNameDuplicated, AiBackendCategoryInvalid, AiBackendFieldsMissing,
            ProjectNotFound, ProjectNameInvalid, ProjectSlugDuplicated, ProjectBadState,
            StoryNotFound, StoryDuplicated, StoryBadState, SceneNotFound, CharacterNotFound,
            EpisodeNotFound, EpisodeTitleInvalid, EpisodeBadMove, EpisodeGenerateMissing,
            EpisodeGenerateCountBad, EpisodeImportContentBad, EpisodeImportTypeBad, EpisodeReorderFailed,
            JobNotFound, JobBadState, JobCancelFailed, JobProgressError,
            FileTooLarge, FileTypeNotAllowed, FileNotFound, FileWriteFailed,
            AiRateLimited, AiTimeout, AiBadFormat, AiAuthFailed,
            AiBackendMissing, AiRequestFailed, AiBadStatus, AiJsonParseFailed,
            DatabaseError, DatabaseQueryError, DatabaseConstraint,
            ObjectStorageError, MqError, RenderNodeError,
        ];
        let mut seen: HashSet<String> = HashSet::new();
        for code in all {
            let s = code.code();
            assert!(seen.insert(s.clone()), "错误码重复: {s} = {code:?}");
        }
    }

    #[test]
    fn code_format() {
        assert_eq!(ErrorCode::Ok.code(), "S00000");
        assert_eq!(ErrorCode::ProjectNotFound.code(), "E04001");
        assert_eq!(ErrorCode::StoryNotFound.code(), "E04011");
        assert_eq!(ErrorCode::AiTimeout.code(), "E07002");
    }
}
