# Unlimited Story Works (无限绘卷)

> 本地自动化 AI 剧本与剧集自动生成工具 —— "让每一个好故事都有被看见的机会。"

![Tech Stack](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript%206%20%2B%20Vite%208-blue)
![Tech Stack](https://img.shields.io/badge/Backend-Rust%201.80%2B%20%2F%20Axum%200.8%20%2F%20Tokio-brightgreen)
![Tech Stack](https://img.shields.io/badge/API%20Docs-utoipa%20Swagger%20UI-indigo)
![Tech Stack](https://img.shields.io/badge/UI-shadcn%2Fui%20%2B%20Tailwind%20CSS%204-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## 📖 项目简介

Unlimited Story Works（无限绘卷）是一款**本地化运行**的 AI 剧集自动生成平台，面向需要快速产出短剧、剧本、分镜到成片的创作者与团队。项目从创意到最终视频输出全部可在本地或私有环境中完成，保护创作数据与知识产权。

当前进度（按内部 Step 推进）：

| Step | 模块 | 状态 |
|---|---|---|
| Step 0 | Rust Axum 最小 demo（hello world） | ✅ |
| Step 1 | `config.yaml` 单例（YAML → `AppConfig` struct + once_cell） | ✅ |
| Step 2 | ErrorCode 9 类 36 个 + `ApiResponse {code, success, message, data}` 四字段信封 | ✅ |
| Step 3 | 分层：`config/ common/ routes/ services/` 拆分，避免大文件 | ✅ |
| Step 4 | Tracing 三目标（console/file/both）× 三格式（pretty/compact/json） | ✅ |
| Step 5 | utoipa 5 + Swagger UI 9（`/swagger-ui/`、`/openapi.json`） | ✅ |
| Step 6 | 前端 Settings 页对接 `/api/v1/config`（useQuery + ApiResponse 解信封） | ✅ |
| Step 7 | 用户 / 权限 + 剧集 CRUD API + SQLite | 🟡 规划中 |
| Step 8 | AI 剧本生成管线 + 长任务队列 | 🟡 规划中 |
| Step 9 | 素材生成（文生图/语音）+ ffmpeg 视频合成 | 🟡 规划中 |

---

## ✨ 主要功能（已实现）

- **后端**
  - `/api/v1/config`：实时读取 `config.yaml` 所有字段，带 `ApiResponse` 成功信封
  - `/api/v1/site/info`：站点基本信息（前端首页 Header 用）
  - `/health`：健康检查
  - `/api/v1/error-demo?kind=xxx`：演示 5 种典型错误返回（513 RFC 2324 + `E{类别}{序号}`）
  - `/swagger-ui/`：交互式 Swagger UI，所有 schema 全部由 Rust struct 自动 derive
  - Logging TTL：启动立即清 1 次 + 24h 循环清理过期日志（`keep_days` 配置，0/缺省按 7 天兜底）
- **前端**
  - Header / Sidebar / Content / Footer 四层 Layout，亮暗主题、响应式、侧栏折叠
  - `/settings` 页面 6 张卡片：站点信息 / Server / CORS / Logging / 连通性自检，完全由 `/api/v1/config` 驱动
  - `http.ts` 统一 `ApiResponse` 解信封，`success=false` 统一抛 `ApiError`（含 `code`、`statusCode`、`data`）
  - Vite 代理 5 个前缀：`/api`、`/health`、`/openapi.json`、`/swagger-ui`、`/swagger-ui/` → 后端 `:5000`

---

## 🏗️ 技术栈

### 前端（`/frontend`）

- **框架**: React 19 + TypeScript 6 + Vite 8
- **路由**: React Router 7
- **数据请求**: @tanstack/react-query 5（staleTime/dedup/retry 内置）
- **表单**: react-hook-form 7 + zod 4
- **状态管理**: Zustand（布局/菜单/主题全局 store）
- **样式**: Tailwind CSS 4 + shadcn/ui（Base UI 底层）+ Hugeicons 图标
- **UI 组件**: Toast / Card / NavigationMenu / Sidebar / Button / Separator / Tooltip / Skeleton 等
- **Lint / 构建**: oxlint（快速）+ `tsc -b`（严格 TS）+ vite rollup 打包

### 后端（`/backend`）

- **语言/运行时**: Rust 1.80+（stable） + Tokio 1 async runtime
- **Web 框架**: Axum 0.8（路由、extractors、中间件分层）
- **配置**: `serde_yaml` + `once_cell::sync::Lazy` 单例，路径 `--config` 传入
- **错误体系**: `ErrorCode` 9 大类 36 个语义码 + `AppError` anyhow 兼容 + HTTP 513 RFC 2324 响应
- **日志**: tracing 0.1 + tracing-subscriber（pretty/compact/json）+ tracing-appender daily 滚动 + 自研 TTL 清理协程
- **API 文档**: utoipa 5（从 struct/handler 宏直接生成）+ utoipa-swagger-ui 9
- **端口约定**: 监听 `0.0.0.0:5000`

---

## 📂 目录结构

```
unlimitedstoryworks/
├── frontend/                         # React 前端
│   ├── public/                       # 静态资源
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/               # Layout 6 大组件 + 统一入口
│   │   │   └── ui/                   # shadcn/ui 原子组件
│   │   ├── hooks/                    # 通用 hooks
│   │   ├── lib/utils.ts              # cn() / 工具函数
│   │   ├── pages/
│   │   │   └── Settings.tsx          # Step 6 已对接 /api/v1/config
│   │   ├── router/index.ts           # React Router 路由表
│   │   ├── services/
│   │   │   ├── http.ts               # ApiResponse 解信封 + ApiError
│   │   │   └── menu.tsx              # 菜单数据 service（未来接后端）
│   │   └── store/                    # Zustand stores
│   ├── index.css                     # Tailwind + 亮/暗 CSS 变量
│   └── package.json
│
├── backend/                          # Rust Axum 后端
│   ├── Cargo.toml                    # 依赖按功能分组
│   ├── config.yaml                   # 全部运行时配置（不进 .gitignore，缺字段有默认兜底）
│   ├── src/
│   │   ├── main.rs                   # 启动入口
│   │   ├── config/                   # 配置：model.rs 定义 + mod.rs 加载 + once_cell
│   │   ├── common/                   # 公共：error / error_codes / response / logging
│   │   ├── routes/                   # 路由：app / health / swagger
│   │   └── services/                 # 业务逻辑（未来：AI 剧本、素材、ffmpeg）
│   └── logs/                         # 运行时产生的日志文件（已忽略）
│
├── .claude/   .trae/                 # IDE / Agent 全局规则（见下方"AI 规则说明"）
├── .gitignore
└── README.md
```

---

## 🚀 快速开始

### 前置依赖

| 工具 | 最低版本 | 说明 |
|---|---|---|
| Node.js | 20+ | 推荐 22 LTS；前端用 **pnpm** 作包管理器 |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Rust | 1.80+ (stable) | `rustup default stable` |
| ffmpeg | 6+ | 视频合成管线需要（`apt install ffmpeg` / `brew install ffmpeg`） |

### 一键两端启动（推荐，两个终端）

**终端 1 —— Rust 后端（:5000）**

```bash
cd backend
cargo run -- --config ./config.yaml
```

启动完成控制台会打印：
```
▶ site    : Unlimited Story Works v0.1.0 (development)
▶ listen  : http://0.0.0.0:5000
▶ demo    : GET /api/v1/config, /api/v1/error-demo?kind=invalid_param
```

后端关键地址：
- 健康检查 —— http://127.0.0.1:5000/health
- 配置接口 —— http://127.0.0.1:5000/api/v1/config
- Swagger UI —— http://127.0.0.1:5000/swagger-ui/
- OpenAPI JSON —— http://127.0.0.1:5000/openapi.json

**终端 2 —— React 前端（:5173 或 +1）**

```bash
cd frontend
pnpm install          # 首次（后续已经装过可跳过）
pnpm dev
```

打开前端 **Settings 页**证明两端打通：
- http://127.0.0.1:5173/settings （若 5173 被占用请按 vite 打印的端口）
- 连通性自检卡片应显示 **✓ OK (200)** + 代码片段 `"code": "S00000"` + `port: 5000` + `keep_days: 7`
- 站点卡片显示"无限绘卷"，Logging 卡片显示 Keep days = 7 天

### 生产构建

```bash
# 前端（输出 frontend/dist/，可由 Axum ServeDir 托管）
cd frontend && pnpm build

# 后端（单二进制，target/release/unlimitedstoryworks）
cd backend && cargo build --release
```

---

## 🔌 API 一览（当前已实现）

| 方法 | 路由 | 说明 | 成功 |
|---|---|---|---|
| `GET` | `/` | 根路径 | 200 + site_info |
| `GET` | `/health` | 健康检查 | 200 `{env,status,version}` |
| `GET` | `/api/v1/config` | 读取全部 config.yaml 字段 | 200 + `AppConfig` |
| `GET` | `/api/v1/site/info` | 只返回 site_info 部分 | 200 + `SiteInfoConfig` |
| `GET` | `/api/v1/error-demo?kind=xxx` | 错误演示（kind 见 error_codes.rs） | **513** + E 码 |
| `GET` | `/openapi.json` | OpenAPI 3.1 schema | 200 JSON |
| `GET` | `/swagger-ui/` | Swagger UI 交互页 | HTML |

统一信封：
```ts
interface ApiResponseEnvelope<T> {
  code: string       // "S00000" = 成功；"E{2 类别}{3 序号}" = 错误
  success: boolean
  message: string    // 错误时是中文描述，成功时固定 "ok"
  data: T
}
```

前端已经把解信封封装在 `frontend/src/services/http.ts` 里，直接 `http.get<AppConfig>('/api/v1/config')` 就能拿到脱壳后的 `data`。

---

## 🛡️ 配置变更默认行为（logging.keep_days 示例）

用户可能写 3 种写法，行为一致（不会有意外区别）：

| `config.yaml` 里 `logging.keep_days` 写的是 | 真实生效 |
|---|---|
| `keep_days: 7` / `keep_days: 3` 等正数 | 按写的天数，日期 ≥ 今天-N 保留，< 的才删 |
| 字段**完全不写** | `#[serde(default)]` → 0 → normalize → **7** 天兜底 |
| `keep_days: 0` | 同上 normalize → **7** 天兜底 |
| `keep_days: -1` 负数 | **启动直接拒绝**（validate() 报"不能为负数"） |

---

## 🎨 设计主题

当前前端的颜色方案来源于 `frontend/src/assets/style/infinity.scss`（infinity 品牌蓝色），已映射到 shadcn CSS 变量：

| 语义 | 亮色 | 暗色 |
|---|---|---|
| 主色 (Primary) | `#5E7CE0` | `#5E7CE0` |
| 页面背景 (Background) | `#F7F7F9` | `#202124` |
| 卡片 (Card) | `#FFFFFF` | `#2E2F31` |
| 选中/高亮 (Accent) | `#DBE4FB` | `#45528A` |
| 边框 (Border) | `#D7D8DA` | `#505153` |
| 危险 (Destructive) | `#F66F6A` | `#F66F6A` |
| 成功 (Success) | `#50D4AB` | `#50D4AB` |

---

## 🧪 代码检查

```bash
# 前端：oxlint 快检 + tsc 严格 TS + vite 打包
cd frontend && pnpm build

# 后端：类型 + 警告检查（不会构建整个优化二进制）
cd backend && cargo check
```

## 🤖 AI 规则说明

`.claude/`、`.trae/` 目录是 Agent 专属规则（Claude Code / TRAE），包含：
- 技术栈、命令速查
- 筋斗云 / Vue 3 老项目残留**已完全移除**，现在所有规则描述统一是 Unlimited Story Works / 无限绘卷
- 协作规则（先确认再动手 / 简单优先 / 精准修改 / 以验证为目标 / Rust dead_code 不许随手 allow）

这些目录默认进 `.gitignore`，不会被提交。

---

## 🗺️ Roadmap

- [x] **阶段 1**: 前端 Layout 框架、主题、shadcn 组件
- [x] **阶段 2**: 菜单 data service/store 解耦
- [x] **阶段 3**: Rust Axum 后端（配置/错误/分层/日志/Swagger UI）
- [x] **阶段 4**: Settings 页前后端首条 API 打通（`/api/v1/config`）
- [ ] **阶段 5**: 用户/权限 + 剧集 CRUD API + SQLite（sqlx / SeaORM）
- [ ] **阶段 6**: AI 剧本生成管线（大模型接入 + async 队列 + 流式进度）
- [ ] **阶段 7**: 素材生成（文生图/文生语音）+ ffmpeg 视频合成
- [ ] **阶段 8**: 部署文档（Docker Compose / systemd / 单二进制发布）

---

## 📄 License

MIT © Unlimited Story Works
