# Unlimited Story Works (无限绘卷)

> 本地自动化 AI 剧本与剧集自动生成工具 —— "让每一个好故事都有被看见的机会。"

![Tech Stack](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript%20%2B%20Vite-blue)
![Tech Stack](https://img.shields.io/badge/Backend-Rust%20%2B%20Axum%20%2B%20Tokio-brightgreen)
![Tech Stack](https://img.shields.io/badge/UI-shadcn%2Fui%20%2B%20Tailwind%20CSS%204-indigo)
![License](https://img.shields.io/badge/license-MIT-green)

## 📖 项目简介

Unlimited Story Works（无限绘卷）是一款**本地化运行**的 AI 剧集自动生成平台，面向需要快速产出短剧、剧本、分镜到成片的创作者与团队。项目从创意到最终视频输出全部可在本地或私有环境中完成，保护创作数据与知识产权。

当前阶段先完成前端骨架和设计系统，后续接入 Rust/Axum 后端、AI 模型调用管线与视频合成引擎。

---

## ✨ 主要功能

| 模块 | 说明 | 进度 |
|---|---|---|
| 项目管理 | 故事/剧集/版本/标签的 CRUD、团队协作 | 🟡 规划中 |
| AI 剧本生成 | 基于大模型的大纲→分集→分镜→对白流水线 | 🟡 规划中 |
| 角色 & 场景库 | 人物档案、场景设定、关系图谱、视觉参考 | 🟡 规划中 |
| 分镜与对话 | 每集/每章节的分镜+对白+情绪+背景音乐标注 | 🟡 规划中 |
| AI 素材生成 | 接入文生图/文生语音/数字人（可选外部服务） | 🟡 规划中 |
| 视频合成 | 拼接→字幕→配乐→多格式导出（ffmpeg 管线） | 🟡 规划中 |
| 前端设计系统 | React 19 + shadcn/ui + Tailwind CSS 4 Layout 框架 | ✅ 已完成 |

---

## 🏗️ 技术栈

### 前端（`/frontend`）

- **框架**: React 19 + TypeScript + Vite 5
- **路由**: React Router 7
- **状态管理**: Zustand（布局/菜单/主题全局 store）
- **样式**: Tailwind CSS 4 + shadcn/ui（Base UI 底层）+ Hugeicons 图标
- **UI 组件**: Toast / Card / NavigationMenu / Sidebar / Button / Separator / Tooltip 等
- **布局**: Header + Sidebar + ToolBar + Content + Footer 四层结构，支持 dark/light 主题、响应式、侧栏 icon 折叠

### 后端（`/backend`，规划中）

- **语言/运行时**: Rust 1.80+（stable） + Tokio async runtime
- **Web 框架**: Axum 0.7+（路由、中间件、extractors）
- **配置**: Figment / serde（TOML + env 覆盖）
- **数据库**: SQLite（开发）→ PostgreSQL（生产），sqlx 或 SeaORM
- **任务队列**: Tokio Tracing + async 队列（剧本/视频合成长任务）
- **文件存储**: 本地对象存储（可选 MinIO / S3 兼容）
- **AI 集成**: 支持接入 OpenAI / Anthropic / 本地 Ollama（Chat Completions 兼容）
- **静态资源**: 前端 dist 由 Axum ServeDir 托管（单二进制部署）

---

## 📂 目录结构

```
unlimitedstoryworks/
├── frontend/                     # React 前端（当前已存在）
│   ├── public/                   # 静态资源 (logo.png 等)
│   ├── src/
│   │   ├── assets/               # 图片/SCSS 主题（含 infinity.scss 旧设计色板）
│   │   ├── components/
│   │   │   ├── layout/           # Layout 6 大组件 + 统一入口
│   │   │   └── ui/               # shadcn/ui 安装的原子组件
│   │   ├── hooks/                # 通用 hooks (use-mobile.ts)
│   │   ├── lib/utils.ts          # cn / 工具函数
│   │   ├── pages/                # Home / About / 404 等路由页面
│   │   ├── router/index.ts       # React Router 路由表
│   │   ├── services/menu.tsx     # 菜单数据 service（未来接后端 /api/menu）
│   │   └── store/                # Zustand store（useLayoutStore / useMenuStore）
│   ├── index.css                 # Tailwind + 亮/暗 CSS 变量主题
│   └── package.json
│
├── backend/                      # Rust Axum 后端（待创建）
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs             # 配置加载
│   │   ├── routes/               # Axum 路由
│   │   ├── services/             # 业务逻辑（剧本生成、AI 调用、ffmpeg 管线）
│   │   ├── models/               # 数据模型（sqlx/SeaORM）
│   │   └── middleware/           # 鉴权 / CORS / Logging
│   └── migrations/               # 数据库迁移 SQL
│
├── .agents/  .claude/  .trae/    # IDE/Agent 辅助配置（不入仓库）
└── README.md
```

---

## 🚀 快速开始

### 前置依赖

| 工具 | 最低版本 | 说明 |
|---|---|---|
| Node.js | 20+ | 推荐 22 LTS，前端 `pnpm` 作为包管理器 |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Rust | 1.80+ (stable) | `rustup default stable`（后端构建需要） |
| ffmpeg | 6+ | 视频合成管线需要（`brew install ffmpeg` 或 `apt install ffmpeg`） |

### 启动前端（已有示例）

```bash
# 进入前端目录
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器（默认端口 5173，若占用会自动 +1）
pnpm dev

# 构建生产包
pnpm build
```

打开 http://127.0.0.1:5173/ 即可看到 Layout 骨架：

- **Header**: logo + 网站名 + 导航（首页/关于）+ ThemeToggle（亮/暗切换）
- **Sidebar**: 主菜单 / 创作中心子菜单 / 底部 `<<<` / `>>>` 双箭头折叠按钮
- **Content**: Home & About 页面的功能介绍卡片
- **Footer**: 平铺式 8 个链接 + 版权行

### 启动后端（规划中）

```bash
# 创建后端目录与 Axum 脚手架
mkdir -p backend && cd backend
cargo init --name usw-backend

# 运行（等 Cargo.toml 写好 axum 依赖后）
cargo run --release
```

后端监听端口推荐 **3000**，并提供以下 `/api` 前缀路由：

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/v1/menu` | `GET` | 全局菜单（HeaderNav + SidebarSections + FooterLinks） |
| `/api/v1/stories` | `GET/POST` | 剧集列表 / 新建故事 |
| `/api/v1/stories/:id` | `GET/PUT/DELETE` | 单个剧集 CRUD |
| `/api/v1/generate/script` | `POST` | 触发 AI 剧本生成长任务（返回 job_id） |
| `/api/v1/jobs/:id` | `GET` | 查询长任务进度 |
| `/api/v1/health` | `GET` | 健康检查 |

---

## 🎨 设计主题

当前前端的颜色方案来源于 `frontend/src/assets/style/infinity.scss`（旧项目蓝色风格），已映射到 shadcn CSS 变量：

| 语义 | 亮色 | 暗色 |
|---|---|---|
| 主色 (Primary) | `#5E7CE0` | `#5E7CE0` |
| 页面背景 (Background) | `#F7F7F9` | `#202124` |
| 卡片 (Card) | `#FFFFFF` | `#2E2F31` |
| 选中/高亮 (Accent) | `#DBE4FB` | `#45528A` |
| 边框 (Border) | `#D7D8DA` | `#505153` |
| 危险 (Destructive) | `#F66F6A` | `#F66F6A` |
| 成功 (Success) | `#50D4AB` | `#50D4AB` |

菜单/按钮等选中态背景走 `--accent`（品牌蓝半透明），与 infinity 老项目视觉一致。

---

## 🧭 菜单数据来源（前后端解耦）

前端导航（Header / Sidebar / Footer）**不再写死在组件里**，统一由：

1. **`frontend/src/services/menu.tsx`** — 4 个 async 函数（`fetchHeaderMenu / fetchSidebarMenu / fetchFooterLinks / fetchAllMenu`），目前是静态 Demo，**后续只需把这 4 个函数改成 `fetch('/api/v1/menu')` 即可无缝接入后端**。
2. **`frontend/src/store/useMenuStore.ts`** — Zustand store：`loadAll() / setAll() / setHeaderMenu()` 等 API。
3. `Layout.tsx` 首次挂载自动 `useEffect(() => loadAll(), [])`。

这样后端可按权限/角色返回不同菜单（普通用户 / 管理员 / 创作者），前端不需要改组件。

---

## 🧪 代码检查

```bash
# 前端 Lint（oxlint）+ TypeScript 严格检查 + 构建
cd frontend && pnpm build
```

构建脚本：`"build": "pnpm lint && tsc -b && vite build"`（顺序：lint → tsc 严格类型检查 → vite rollup 打包）。

---

## 🗺️ Roadmap

- [x] **阶段 1**: 前端 Layout 框架（Header/Nav/Sidebar/Content/Footer/Toast）、主题、shadcn 组件
- [x] **阶段 2**: 菜单数据 service/store 解耦，为后端 /api/menu 预留接口
- [ ] **阶段 3**: Rust + Axum 后端脚手架（配置、健康检查、菜单接口、SQLite）
- [ ] **阶段 4**: 用户/权限 + 项目/剧集数据模型 + CRUD API
- [ ] **阶段 5**: AI 剧本生成管线（大模型接入 + 任务队列 + 进度流式）
- [ ] **阶段 6**: 素材生成（文生图/文生语音）与 ffmpeg 视频合成
- [ ] **阶段 7**: 部署文档（Docker Compose / systemd / 单二进制发布）

---

## 📄 License

MIT © Unlimited Story Works
