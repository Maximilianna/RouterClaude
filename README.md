<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/RouterClaude-FF7A00?style=for-the-badge&logo=tauri&logoColor=white">
    <img src="https://img.shields.io/badge/RouterClaude-FF5500?style=for-the-badge&logo=tauri&logoColor=white" alt="RouterClaude" width="240">
  </picture>
</p>

<p align="center">
  <b>Claude Code Desktop 模型供应商配置管理工具 · 内置本地代理转发</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri_2-FFC131?logo=tauri&logoColor=black" alt="Tauri 2">
  <img src="https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript_5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Spring_Boot_3.4-6DB33F?logo=springboot&logoColor=white" alt="Spring Boot 3.4">
  <img src="https://img.shields.io/badge/Java_25-ED8B00?logo=openjdk&logoColor=white" alt="Java 25">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
</p>
<p align="center">
  <i>可视化管理 Claude Code Desktop 模型供应商配置 · 自动去除 <code>claude-</code> 前缀转发 · 全本地运行</i>
</p>


---

## 为什么需要 RouterClaude？

Claude Code Desktop 要求所有模型名称必须以 `claude-` 开头（如 `claude-DeepSeek-V4-Flash`），但绝大多数模型供应商（DeepSeek、OpenAI-compatible 等）并不识别这种格式。每次手动改模型名不现实，直接在 CCD 里配原始模型名又无法通过校验。

RouterClaude 就是为了解决这个错位而生：

1. **接管 CCD 的 API 请求** — CCD 发送 `claude-DeepSeek-V4-Flash` 到本地代理
2. **自动去除前缀** — 代理剥离 `claude-`，还原为 `DeepSeek-V4-Flash`
3. **转发到真实供应商** — 使用正确的模型名调用供应商 API

同时提供可视化界面管理多个供应商配置，一键切换 CCD 使用的模型。

---

## 功能特性

<table>
<tr>
  <td width="50%">
    <h4>📦 供应商管理</h4>
    可视化添加、编辑、删除、启用/禁用、拖拽排序模型供应商，内置主流预设模板
  </td>
  <td width="50%">
    <h4>🔄 模型名称转发</h4>
    内置代理（<code>:8901</code>）自动去除 <code>claude-</code> 前缀，SSE 流式响应实时透传
  </td>
</tr>
<tr>
  <td width="50%">
    <h4>📊 代理日志 & Token 统计</h4>
    实时查看请求日志，按日/周/月统计 Token 消耗，数据持久化存储
  </td>
  <td width="50%">
    <h4>🔒 完全本地运行</h4>
    无云端依赖，中英文界面，支持自动更新检查
  </td>
</tr>
</table>

---

## 架构

```
    ┌───────────────────────────────────────────────────┐
    │                  Tauri 桌面壳                      │
    │   ┌──────────────────┐      ┌──────────────────┐  │
    │   │   React UI       │      │   Java 后端      │  │
    │   │   (WebView)      │◄────►│   (Spring Boot)  │  │
    │   └──────────────────┘ REST └───────┬──────────┘  │
    │                            :8900    │              │
    └─────────────────────────────────────┼──────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │                       │                       │
                  ▼                       ▼                       ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │   CCD 配置文件    │  │  代理服务 :8901  │  │   供应商 API     │
        │  _meta.json      │  │ 去除 claude- 前缀 │◄─│  DeepSeek / ...  │
        │  {uuid}.json     │  │ → 转发真实请求    │  │                  │
        └──────────────────┘  └──────────────────┘  └──────────────────┘

   CCD ─── POST /v1/messages ───► 代理 :8901 ─── 去除前缀 ───► 供应商 API
```

### 配置目录结构

```
~/.routerclaude/
├── ccd/                  # CCD 配置文件（同步写入 CCD 目录）
│   ├── _meta.json        # 供应商注册表 + 激活状态
│   └── {uuid}.json       # 单个供应商配置
└── data/                 # 应用数据（持久化）
    ├── logs.json         # 代理请求日志（最近 500 条）
    └── usage.json        # Token 用量记录（最近 10000 条）
```

<details>
<summary><b>技术栈</b></summary>
<br>

| 层级 | 技术 |
|---|---|
| 前端 | React 18, TypeScript 5, Vite 6, Tailwind CSS 3 |
| 桌面壳 | Tauri 2 |
| 后端 | Java 25, Spring Boot 3.4 |
| 数据库 | 无（基于文件系统的 JSON 配置 + 环形缓冲区持久化） |
| 国际化 | i18next + react-i18next |
| 状态管理 | TanStack React Query |
| 拖拽排序 | @dnd-kit |
| 构建工具 | pnpm（前端）, Maven（后端） |

</details>

---

## 快速开始

### 环境要求

| 依赖 | 版本要求 |
|---|---|
| Node.js | 20+ |
| pnpm | 最新 |
| Java | 21+ (JDK) |
| Maven | 3.9+ |
| Rust | 最新稳定版 |
| WebView2 | Windows 11 预装 |

### 开发模式

```bash
# 安装前端依赖
pnpm install

# 构建后端 JAR 并启动
cd backend && mvn package -DskipTests && cd .. && pnpm tauri dev
```

或使用一键命令：

```bash
pnpm dev:full
```

### 运行测试

```bash
# 后端测试（56 个用例）
cd backend && mvn test

# 前端测试
pnpm test
```

---

## 生产构建

```bash
# 构建后端 JAR
cd backend && mvn package -DskipTests

# （可选）jlink 裁剪最小 JRE（约 40MB）
cd backend && mvn package -Pjlink -DskipTests

# 构建安装包（.msi / .dmg / .AppImage）
cd .. && pnpm tauri build
```

安装包内包含 React 前端静态资源、Spring Boot 后端 JAR、（可选）jlink 裁剪后的 JRE、Tauri 运行时。

---

## 使用指南

### 添加供应商

1. 启动 RouterClaude
2. 点击 **+ 添加供应商**
3. 选择预设模板（如 DeepSeek）或选择自定义
4. 填写 API Key，可点击 **自动发现** 拉取模型列表
5. 点击 **创建**

### 启用供应商

勾选供应商卡片上的 **启用** 复选框，将该供应商设为 CCD 当前激活供应商（更新 `_meta.json` 中的 `appliedId`）。

### 在 CCD 中使用

启用供应商后，代理服务器 `127.0.0.1:8901` 开始转发请求：

1. 在 CCD 中将推理网关地址设为 `http://127.0.0.1:8901`
2. 选择以 `claude-` 开头的模型（如 `claude-DeepSeek-V4-Flash`）
3. CCD 发送请求到本地代理，代理自动去除前缀并转发到真实供应商 API

### 查看日志和用量

切换到 **日志** 标签页查看代理请求记录，切换到 **用量** 标签页查看 Token 消耗统计。数据在应用重启后自动恢复。

### 检查更新

切换到 **关于** 标签页，点击 **检查更新** 按钮。如有新版本，弹窗提示是否下载安装。

### 端口说明

| 端口 | 服务 | 说明 |
|---|---|---|
| `8900` | 管理 API | 前端调用的后端 REST API |
| `8901` | 代理服务 | CCD 请求转发代理 |

---

## API 概览

### 管理 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/providers` | 获取所有供应商 |
| `GET` | `/api/providers/{id}` | 获取指定供应商 |
| `POST` | `/api/providers` | 创建供应商 |
| `PUT` | `/api/providers/{id}` | 更新供应商 |
| `DELETE` | `/api/providers/{id}` | 删除供应商 |
| `PATCH` | `/api/providers/{id}/toggle` | 切换启用状态 |
| `GET` | `/api/providers/active` | 获取当前启用供应商 |
| `POST` | `/api/providers/{id}/test` | 测试供应商连接 |
| `POST` | `/api/providers/reorder` | 保存供应商排序 |
| `POST` | `/api/providers/discover` | 自动发现模型 |

### 代理 API（`:8901`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/v1/messages` | 转发 Claude Messages API 请求 |
| `POST` | `/v1/complete` | 转发 Claude Completions API 请求 |
| `GET` | `/v1/models` | 获取当前启用供应商的模型列表 |

### 代理状态 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/proxy/status` | 代理运行状态 |
| `GET` | `/api/proxy/logs?limit=100` | 代理请求日志 |

### 用量统计 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/usage/summary?period=today` | Token 用量汇总（today/week/month） |
| `GET` | `/api/usage/details?limit=50` | 最近调用明细 |

### 更新检查 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/update/check?currentVersion=1.0.1` | 检查 GitHub Releases 最新版本 |

---

## 项目结构

```
router-claude/
├── src/                          # React 前端
│   ├── components/               # UI 组件
│   │   ├── ProviderCard.tsx      # 供应商卡片（拖拽排序、标签、测试）
│   │   ├── ProviderForm.tsx      # 供应商表单（预设、API模式、自动发现）
│   │   ├── ModelEditor.tsx       # 模型列表编辑器
│   │   ├── LogPanel.tsx          # 代理日志面板
│   │   ├── UsagePanel.tsx        # Token 用量统计
│   │   ├── AboutPanel.tsx        # 关于页面（版本信息、更新检查）
│   │   └── Toast.tsx             # Toast 弹窗组件
│   ├── hooks/                    # TanStack Query Hooks
│   ├── data/                     # 预设供应商数据
│   ├── utils/                    # 工具函数（错误码翻译）
│   ├── i18n/                     # 中英文语言包
│   └── types/                    # TypeScript 类型定义
├── src-tauri/                    # Tauri 桌面壳
│   ├── src/main.rs               # 入口，管理 Java sidecar 生命周期
│   └── capabilities/             # Tauri 权限配置
├── backend/                      # Java Spring Boot 后端
│   └── src/main/java/com/routerclaude/
│       ├── controller/           # REST API 控制器
│       ├── service/              # 业务逻辑层
│       ├── config/               # 配置文件读写 + 数据持久化
│       ├── proxy/                # 模型转发代理服务器 + 日志
│       └── model/                # 数据模型
└── docs/                         # 开发文档
```

---

## 更新日志

### v1.1.0

- **预设模板**：内置 DeepSeek、Mimo、GLM、Kimi、MiniMax 等供应商预设，一键创建
- **API 模式切换**：支持 OpenAI / Anthropic 兼容模式，切换时自动填充 URL
- **模型自动发现**：从供应商 API 自动拉取可用模型列表
- **代理日志面板**：实时查看代理请求日志，数据持久化到 `~/.routerclaude/data/logs.json`
- **Token 用量统计**：按日/周/月统计 Token 消耗，SSE 流式响应中自动提取 usage 数据，持久化到 `~/.routerclaude/data/usage.json`
- **供应商标签**：为供应商添加自定义标签
- **连接测试增强**：批量测试所有供应商，Toast 弹窗显示结果
- **配置目录重构**：CCD 配置文件迁移至 `~/.routerclaude/ccd/`，应用数据存放在 `~/.routerclaude/data/`，为未来支持更多客户端做准备
- **关于页面**：查看版本信息，从 GitHub Releases 检查更新，一键下载安装
- **API Key 可见性切换**：输入框内置眼睛图标按钮，切换显示/隐藏 API Key
- **用量页刷新按钮**：手动刷新 Token 用量数据

### v1.0.1

- **拖拽排序供应商**：使用 @dnd-kit 替换原生拖拽，仅抓手图标触发动画流畅，支持垂直轴约束和父容器边界限制
- **修复排序持久化**：`listAll()` 现在按 `_meta.json` 中 `entries` 顺序返回供应商，解决启用/禁用后排序丢失的问题
- **后端错误信息国际化**：后端错误消息改为错误码，前端通过 i18n 翻译显示，英文模式下不再出现中文提示

### v1.0.0

- 初始发布

---

<p align="center">
  <sub>Built with</sub>
  <br>
  <img src="https://img.shields.io/badge/Tauri-FFC131?logo=tauri&logoColor=black" alt="Tauri">
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Spring_Boot-6DB33F?logo=springboot&logoColor=white" alt="Spring Boot">
  <br>
  <sub>MIT License © 2026</sub>
</p>
