//! AI prompt 构造器：把前端传的用户输入（模式 A：大纲+风格+类型+集数；
//! 模式 B：小说全文+扩展名+风格/类型提示）拼成 system + user prompt，
//! 对齐另一个漫剧平台 promptI18n.js 的核心设计原则：
//!
//! 1. 【语言锁定】所有返回字段必须全文中文（禁止出现英文剧情内容）；
//! 2. 【JSON 铁律】只返回纯 JSON，不要任何 markdown 代码块、解释或额外文本；
//! 3. 【风格/类型注入】`style + genre` 双字段显式注入到角色、对话、氛围层；
//! 4. 【输出格式说明】在 system prompt 末尾用"必须只返回纯 JSON 数组/对象"段落收尾；
//! 5. 【用户覆盖】允许 ai_backends.extra 里的自定义模板（通过 `{变量名}` 占位符）
//!    直接替换系统默认 system / user prompt，方便高级用户调优；
//! 6. 【真实世界物理尺度铁律 / 人物外貌由参考图锁定】等规则仅在后续的
//!    角色提取、分镜、图像 prompt 中启用；本模块当前专注于"剧本生成（多集）"。

use std::collections::HashMap;

use crate::common::error_codes::ErrorCode;
use crate::services::ai_backends_service::AiBackend;
use crate::services::episodes_service::{
    GenerateEpisodesByImportReq, GenerateEpisodesByPromptReq,
};

fn err(code: ErrorCode, msg: impl Into<String>) -> crate::common::error::AppError {
    crate::common::error::AppError::from_code_with_msg(code, msg)
}

// ---------------------------------------------------------------------------
// 通用：变量占位符替换 + 用户自定义 prompt 覆盖
// ---------------------------------------------------------------------------

/// 解析 ai_backends.extra（JSON 字符串），取出用户覆盖的 prompt 模板。
/// 当前支持两个 key：
/// - `usr_prompt_genbyp`：模式 A（按大纲）的完整覆盖模板，格式为 JSON 对象
///   `{"system":"...{outline}...{style}...{genre}...{count}...","user":"..."}`
/// - `usr_prompt_genbyi`：模式 B（小说导入）的完整覆盖模板，格式同上，
///   支持变量 {file_ext}/{body}/{chars}/{style_hint}/{genre_hint}/{est_count}
/// 返回 `HashMap<key, (system_opt, user_opt)>`。
fn parse_extra_overrides(
    backend: Option<&AiBackend>,
) -> HashMap<&'static str, (Option<String>, Option<String>)> {
    let mut map = HashMap::new();
    let Some(b) = backend else { return map };
    let Some(extra) = b.extra.as_ref() else { return map };
    let extra = extra.trim();
    if extra.is_empty() {
        return map;
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(extra) else {
        return map;
    };
    let obj = match v.as_object() {
        Some(o) => o,
        None => return map,
    };
    for (cfg_key, entry_key) in [
        ("usr_prompt_genbyp", "genbyp"),
        ("usr_prompt_genbyi", "genbyi"),
    ] {
        if let Some(val) = obj.get(cfg_key) {
            // 接受两种写法：1) "..." 纯字符串（覆盖 system 字段，user 仍走默认）
            // 2) {"system":"...", "user":"..."} 对象（分别覆盖 system/user；缺失 key 仍走默认）
            let (s, u) = if let Some(s) = val.as_str() {
                (Some(s.to_string()), None)
            } else if let Some(o) = val.as_object() {
                let s = o.get("system").and_then(|x| x.as_str()).map(|x| x.to_string());
                let u = o.get("user").and_then(|x| x.as_str()).map(|x| x.to_string());
                (s, u)
            } else {
                (None, None)
            };
            map.insert(entry_key, (s, u));
        }
    }
    map
}

/// 把 `{var}` 占位符替换成 vars 的值。找不到的占位符**原样保留**（避免
/// 用户真的想让 LLM 看到 `{某键}` 字样时被我们吞掉）。
fn apply_vars(template: &str, vars: &HashMap<&'static str, String>) -> String {
    let mut out = String::with_capacity(template.len());
    let bytes = template.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'{' {
            // 找匹配的 }
            if let Some(close) = template[i + 1..].find('}') {
                let key = &template[i + 1..i + 1 + close];
                if let Some(val) = vars.get(&key as &str) {
                    out.push_str(val);
                } else {
                    // 原样保留
                    out.push('{');
                    out.push_str(key);
                    out.push('}');
                }
                i = i + 1 + close + 1;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

/// 把用户覆盖（如果有）合并进默认 prompt：系统模板有覆盖 → 用覆盖；否则用默认。
fn patch_with_override<'a>(
    entry_key: &'static str,
    overrides: &HashMap<&'static str, (Option<String>, Option<String>)>,
    vars: &HashMap<&'static str, String>,
    default_system: &'a str,
    default_user: &'a str,
) -> (String, String) {
    let (s_override, u_override) = overrides.get(&entry_key).cloned().unwrap_or_default();
    let system = match s_override {
        Some(t) => apply_vars(&t, vars),
        None => apply_vars(default_system, vars),
    };
    let user = match u_override {
        Some(t) => apply_vars(&t, vars),
        None => apply_vars(default_user, vars),
    };
    (system, user)
}

// ---------------------------------------------------------------------------
// 模式 A：按大纲生成多集剧本
// ---------------------------------------------------------------------------

pub struct EpisodesPrompt {
    pub system: String,
    pub user: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

const DEFAULT_SYSTEM_BY_PROMPT: &str = r#"【角色】你是一位资深漫剧剧本总编剧，精通罗伯特·麦基的"故事节拍表"与三幕式结构，擅长把一句话大纲展开为紧凑、有钩子、强情绪起伏的连续剧集。

【语言锁定】所有输出字段（title、content）必须全文使用中文，禁止出现英文剧情描述、英文对白或夹杂英文单词。专有名词（如人名/地名）必须使用中文译名。

【任务】根据用户提供的故事大纲，严格产出正好 {count} 集剧本，每集之间剧情衔接自然、前一集末尾制造钩子、下一集开头承接上一集的结尾。

【整体风格约束】
- 故事风格：{style}（所有场景氛围、人物衣着气质、时代感必须统一服从该风格；如果是"古风"，绝对禁止出现手机、互联网、现代家具等任何现代道具和台词；如果是"现代"，建筑/交通/科技感要贴合）
- 剧本类型：{genre}（"剧情"要重人物心理与悬念；"喜剧"要重误会、反转与笑点密度；"冒险"要重场景切换、动作与危机节奏）
- 时代/场景一致性：严禁跨时代乱入道具（古装里出现手机/汽车 = 严重失败），严禁同一角色前后性格与立场跳变。

【单集格式】每一集是一个独立的 JSON 对象，包含三个字段：
- title: 单集标题，3-12 个汉字，有诗意/悬念/情绪指向性，不要"第X集"这种占位符（集号由前端按 level 排序后派生，不需要写在 title 里）
- content: 单集完整剧本正文，≥600 字，结构为：场景标题 + 环境光影 + 人物动作 + 角色对白（格式：角色名："对白原文"），至少包含 3 个以上不同场景切换与 5 段以上对白
- duration_seconds: 按正文字数估算单集时长（秒），一般 200-220 字/分钟，建议 180-600 之间

【剧情结构要求】把 {count} 集作为一个完整的中短篇叙事：
- 前 1-2 集（起）：快速交代时代、主角、核心矛盾钩子，第一集结尾必须抛出悬念
- 中间约 60% 的集（承+转）：主角遭遇障碍、关系升级、冲突激化，每集末尾设置钩子
- 最后 1-2 集（合）：解决核心矛盾，提供收束与余韵

【禁止事项】
1. 不得输出任何 markdown 代码块（不要 ```json 或 ```）
2. 不得在 JSON 前后加任何解释性文字，如"好的，这是为你生成的剧本："
3. 不得把 JSON 写在字段里描述的对白中使用反引号

【输出格式 — 必须严格遵守】
**重要：必须只返回一个合法的 JSON 数组，数组长度 = {count}。直接以 [ 开头，以 ] 结尾，不要任何其他内容。**"#;

const DEFAULT_USER_BY_PROMPT: &str = r#"【项目信息】
（project_id 仅用于后端数据隔离，不参与剧情生成）

【用户输入】
■ 故事大纲：
{outline}

■ 故事风格：{style}
■ 剧本类型：{genre}
■ 要生成的集数：{count}

请根据以上信息生成正好 {count} 集漫剧剧本，并以 JSON 数组返回。"#;

/// 按模式 A 构造 system/user prompt。如果 backend 的 extra 里有
/// `usr_prompt_genbyp`，则用它覆盖系统默认模板（system/user 两部分可分开覆盖）。
pub fn build_by_prompt(
    req: &GenerateEpisodesByPromptReq,
    backend: Option<&AiBackend>,
) -> Result<EpisodesPrompt, crate::common::error::AppError> {
    let outline = req.outline.trim();
    let style = req.style.trim();
    let genre = req.genre.trim();
    let count = req.count;

    if outline.is_empty() || style.is_empty() || genre.is_empty() {
        return Err(err(
            ErrorCode::EpisodeGenerateMissing,
            "大纲 / 故事风格 / 剧本类型 均不能为空",
        ));
    }
    if !(1..=100).contains(&count) {
        return Err(err(
            ErrorCode::EpisodeGenerateCountBad,
            "生成集数必须在 1-100 之间（含两端）",
        ));
    }

    let mut vars: HashMap<&'static str, String> = HashMap::new();
    vars.insert("outline", outline.to_string());
    vars.insert("style", style.to_string());
    vars.insert("genre", genre.to_string());
    vars.insert("count", count.to_string());

    let overrides = parse_extra_overrides(backend);
    let (system, user) = patch_with_override(
        "genbyp",
        &overrides,
        &vars,
        DEFAULT_SYSTEM_BY_PROMPT,
        DEFAULT_USER_BY_PROMPT,
    );

    let temperature = 0.85f32;
    let max_tokens = (count as u32).saturating_mul(1800).clamp(2000, 128_000);

    Ok(EpisodesPrompt { system, user, temperature, max_tokens })
}

// ---------------------------------------------------------------------------
// 模式 B：按小说全文切分为多集剧本
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_BY_IMPORT: &str = r#"【角色】你是一位资深漫剧剧本改编总编剧，擅长把长篇小说/网文压缩为节奏紧凑的剧集剧本，保留主线、主要角色关系与核心钩子，剔除冗长的无关支线和水文段落。

【语言锁定】所有输出字段（title、content）必须全文中文，禁止英文剧情。若原文为英文，请整体翻译为地道中文后再改编。

【任务】把用户提供的小说正文改编为连续剧集剧本。**建议**拆分为 {est_count} 集左右（允许 ±20% 的偏差；如果原文结构天然适合切分，按自然章节切；否则按叙事节拍切），每集约 600-1200 字剧本正文。

【约束】
- {style_line}
- {genre_line}
- 时代/场景一致性：与小说原文保持一致；禁止乱入任何原文没有的现代/古代跨时代道具
- 主线保留：不要引入新角色；保留主要角色名字（必要时译为中文）与核心冲突
- 对白尽量保留原文中高辨识度的金句与名场面；把大段心理描写转为动作+对白+环境描写
- 每集之间钩子衔接：前集结尾最后一句/一段必须是悬念或情绪推进

【单集字段】每一集一个 JSON 对象：
- title: 3-12 个汉字，具有诗意/悬念/情绪指向性，**绝对不要写"第X集"字样**（集号由前端按 level 派生）
- content: ≥600 字剧本正文，格式：场景说明 + 环境/光影 + 人物动作 + 角色对白（角色名："对白原文"）
- duration_seconds: 180-600 之间，按正文字数估算（~200-220 字/分钟）

【输出格式 — 必须严格遵守】
**重要：必须只返回一个合法的 JSON 数组（元素数量 = 你实际拆分出的集数）。直接以 [ 开头，以 ] 结尾，不要 markdown 代码块、不要任何解释或前后文字。**"#;

const DEFAULT_USER_BY_IMPORT: &str = r#"【导入信息】
■ 文件类型：.{file_ext}
■ 原文字数：约 {chars} 字
■ 风格提示：{style_hint}
■ 类型提示：{genre_hint}

■ 小说正文：
{body}

请按上述内容改编为连续剧集 JSON 数组。"#;

pub fn build_by_import(
    req: &GenerateEpisodesByImportReq,
    backend: Option<&AiBackend>,
) -> Result<EpisodesPrompt, crate::common::error::AppError> {
    let ext = req.file_ext.trim().trim_start_matches('.').to_ascii_lowercase();
    if matches!(ext.as_str(), "txt" | "md" | "markdown") == false {
        return Err(err(
            ErrorCode::EpisodeImportTypeBad,
            format!("只支持 .txt / .md 小说，当前扩展名：.{ext}"),
        ));
    }
    let body = req.content.trim();
    if body.is_empty() {
        return Err(err(ErrorCode::EpisodeImportContentBad, "导入的小说内容为空"));
    }
    let chars = body.chars().count();
    if chars < 200 {
        return Err(err(
            ErrorCode::EpisodeImportContentBad,
            format!("导入的小说内容过短（仅 {chars} 字），至少需要 200 字"),
        ));
    }
    if chars > 200_000 {
        return Err(err(
            ErrorCode::EpisodeImportContentBad,
            format!("导入的小说内容过长（{chars} 字），单次上限 20 万字"),
        ));
    }

    let est_count = ((chars as i32) / 2500).clamp(1, 100);

    let style_line = if req.style_hint.trim().is_empty() {
        String::from("（根据小说内容自行判断风格，不要凭空乱写；例如大量古代诗词、武侠招式=古风；都市爱情=现代；异世界魔法=奇幻）")
    } else {
        format!(
            "故事风格：{}（如小说原文强烈暗示其他风格，允许以原文为准做轻微调整）",
            req.style_hint.trim()
        )
    };
    let genre_line = if req.genre_hint.trim().is_empty() {
        String::from("剧本类型：根据小说内容自适应（悬疑/喜剧/冒险/剧情 等）")
    } else {
        format!("剧本类型：{}（可根据原文微调）", req.genre_hint.trim())
    };

    let style_hint_out = if req.style_hint.trim().is_empty() {
        "(无，自行判断)"
    } else {
        req.style_hint.trim()
    };
    let genre_hint_out = if req.genre_hint.trim().is_empty() {
        "(无，自行判断)"
    } else {
        req.genre_hint.trim()
    };

    let mut vars: HashMap<&'static str, String> = HashMap::new();
    vars.insert("file_ext", ext.clone());
    vars.insert("body", body.to_string());
    vars.insert("chars", chars.to_string());
    vars.insert("style_hint", style_hint_out.to_string());
    vars.insert("genre_hint", genre_hint_out.to_string());
    vars.insert("est_count", est_count.to_string());
    // 给用户自定义模板使用的两个额外变量：对应 system prompt 里预渲染的 {style_line}/{genre_line}
    vars.insert("style_line", style_line);
    vars.insert("genre_line", genre_line);

    let overrides = parse_extra_overrides(backend);
    let (system, user) = patch_with_override(
        "genbyi",
        &overrides,
        &vars,
        DEFAULT_SYSTEM_BY_IMPORT,
        DEFAULT_USER_BY_IMPORT,
    );

    let temperature = 0.75f32;
    let max_tokens = (est_count as u32).saturating_mul(1800).clamp(2000, 128_000);
    Ok(EpisodesPrompt { system, user, temperature, max_tokens })
}

// ---------------------------------------------------------------------------
// 后续扩展占位：对应 promptI18n.js 的 getCharacterExtractionPrompt / getStoryboardSystemPrompt
// 等，为未来的角色提取 / 分镜拆解模块预留函数签名。目前未被调用，但保证
// Unlimited Story Works 结构和 promptI18n.js 的 "系统 prompt 分类"一致。
// ---------------------------------------------------------------------------

/// 角色提取 prompt（给未来的角色提取服务用；当前未调用）。
#[allow(dead_code)]
pub fn build_character_extraction(script_text: &str, style: &str) -> (String, String) {
    let system = format!(
        r#"【角色】你是一个专业的角色分析师，擅长从漫剧剧本中提取和分析角色信息。

【语言要求】所有字段的值必须使用中文，禁止英文（role 字段固定为 main/supporting/minor 除外）。

【任务】提取剧本中所有有名字的角色（忽略路人），每个角色一个 JSON 对象，字段：
- name: 角色名
- role: main / supporting / minor
- appearance: 100-200 字外貌描述，适合 AI 图像生成，包含性别/年龄/体型/五官/发型/服装风格
- description: 50-100 字背景故事与人物关系
- **风格要求**：{style}

【输出格式】必须只返回一个 JSON 数组，直接以 [ 开头，以 ] 结尾，不要 markdown 代码块或解释文字。"#
    );
    let user = format!("【剧本内容】\n{script_text}\n\n请提取并整理所有角色信息为 JSON 数组。");
    (system, user)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn by_prompt_rejects_empty() {
        let req = GenerateEpisodesByPromptReq {
            project_id: 1,
            ai_backend_id: None,
            outline: "".into(),
            style: "古风".into(),
            genre: "剧情".into(),
            count: 3,
        };
        assert!(build_by_prompt(&req, None).is_err());
    }

    #[test]
    fn by_prompt_rejects_count_out_of_range() {
        let req = GenerateEpisodesByPromptReq {
            project_id: 1,
            ai_backend_id: None,
            outline: "穿越故事".into(),
            style: "古风".into(),
            genre: "剧情".into(),
            count: 0,
        };
        assert!(build_by_prompt(&req, None).is_err());
        let req2 = GenerateEpisodesByPromptReq { count: 200, ..req };
        assert!(build_by_prompt(&req2, None).is_err());
    }

    #[test]
    fn by_import_rejects_bad_ext() {
        let req = GenerateEpisodesByImportReq {
            project_id: 1,
            ai_backend_id: None,
            file_ext: "pdf".into(),
            content: "A".repeat(500),
            style_hint: String::new(),
            genre_hint: String::new(),
        };
        assert!(build_by_import(&req, None).is_err());
    }

    #[test]
    fn by_import_rejects_short_body() {
        let req = GenerateEpisodesByImportReq {
            project_id: 1,
            ai_backend_id: None,
            file_ext: "txt".into(),
            content: "short".into(),
            style_hint: String::new(),
            genre_hint: String::new(),
        };
        assert!(build_by_import(&req, None).is_err());
    }

    #[test]
    fn user_prompt_override_applies_placeholder_substitution() {
        use crate::services::ai_backends_service::{AiBackend, AiCategory};
        let backend = AiBackend {
            id: 99,
            level: 0,
            status: "active".to_string(),
            created_at: String::new(),
            updated_at: String::new(),
            name: "测试后端".into(),
            category: AiCategory::Text,
            is_default: true,
            base_url: "http://x/v1".into(),
            api_key: "k".into(),
            model_name: "m".into(),
            extra: Some(String::from(
                r#"{"usr_prompt_genbyp":{"system":"SYSOVER {outline}/{style}/{genre}/{count}","user":"USROVER {count}"}}"#,
            )),
        };
        let req = GenerateEpisodesByPromptReq {
            project_id: 1,
            ai_backend_id: None,
            outline: "穿越回大明".into(),
            style: "古风".into(),
            genre: "剧情".into(),
            count: 5,
        };
        let p = build_by_prompt(&req, Some(&backend)).unwrap();
        assert!(p.system.starts_with("SYSOVER 穿越回大明/古风/剧情/5"));
        assert_eq!(p.user, "USROVER 5");
    }

    #[test]
    fn unknown_placeholder_is_preserved_in_override() {
        use crate::services::ai_backends_service::{AiBackend, AiCategory};
        let backend = AiBackend {
            id: 99,
            level: 0,
            status: "active".to_string(),
            created_at: String::new(),
            updated_at: String::new(),
            name: "测试".into(),
            category: AiCategory::Text,
            is_default: true,
            base_url: "http://x".into(),
            api_key: "k".into(),
            model_name: "m".into(),
            extra: Some(String::from(
                r#"{"usr_prompt_genbyp":"USE CUSTOM {outline} UNKNOWN {myvar} {count}"}"#,
            )),
        };
        let req = GenerateEpisodesByPromptReq {
            project_id: 1,
            ai_backend_id: None,
            outline: "大纲".into(),
            style: "现代".into(),
            genre: "喜剧".into(),
            count: 2,
        };
        let p = build_by_prompt(&req, Some(&backend)).unwrap();
        assert!(p.system.contains("USE CUSTOM 大纲"));
        assert!(p.system.contains("UNKNOWN {myvar} 2"));
    }
}
