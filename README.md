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
    可视化添加、编辑、删除、启用/禁用模型供应商
  </td>
  <td width="50%">
    <h4>⚡ 一键配置 CCD</h4>
    直接读写本地 CCD 配置文件（<code>_meta.json</code> / <code>{uuid}.json</code>）
  </td>
</tr>
<tr>
  <td width="50%">
    <h4>🔄 模型名称转发</h4>
    内置代理（<code>:8901</code>）自动去除 <code>claude-</code> 前缀并转发到真实 API
  </td>
  <td width="50%">
    <h4>📡 流式响应支持</h4>
    SSE 流式响应实时透传，零延迟体验
  </td>
</tr>
<tr>
  <td width="50%">
    <h4>🌐 中英文界面</h4>
    根据浏览器语言自动切换，支持手动选择
  </td>
  <td width="50%">
    <h4>🔒 完全本地运行</h4>
    无云端依赖，所有操作在用户机器上完成
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

<details>
<summary><b>技术栈</b></summary>
<br>

| 层级 | 技术 |
|---|---|
| 前端 | React 18, TypeScript 5, Vite 6, Tailwind CSS 3 |
| 桌面壳 | Tauri 2 |
| 后端 | Java 25, Spring Boot 3.4 |
| 数据库 | 无（基于文件系统的 JSON 配置） |
| 国际化 | i18next + react-i18next |
| 状态管理 | TanStack React Query |
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
3. 填写供应商信息：名称（如 `DeepSeek`）、API 地址、API Key、模型列表
4. 点击 **创建**

### 启用供应商

勾选供应商卡片上的 **启用** 复选框，将该供应商设为 CCD 当前激活供应商（更新 `_meta.json` 中的 `appliedId`）。

### 在 CCD 中使用

启用供应商后，代理服务器 `127.0.0.1:8901` 开始转发请求：

1. 在 CCD 中将推理网关地址设为 `http://127.0.0.1:8901`
2. 选择以 `claude-` 开头的模型（如 `claude-DeepSeek-V4-Flash`）
3. CCD 发送请求到本地代理，代理自动去除前缀并转发到真实供应商 API

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

### 代理 API（`:8901`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/v1/messages` | 转发 Claude Messages API 请求 |
| `POST` | `/v1/complete` | 转发 Claude Completions API 请求 |
| `GET` | `/v1/models` | 获取当前启用供应商的模型列表 |

---

## 项目结构

```
router-claude/
├── src/                          # React 前端
│   ├── components/               # UI 组件
│   ├── hooks/                    # TanStack Query CRUD Hooks
│   ├── i18n/                     # 中英文语言包
│   └── types/                    # TypeScript 类型定义
├── src-tauri/                    # Tauri 桌面壳
│   └── src/main.rs               # 入口文件，管理 Java sidecar 生命周期
├── backend/                      # Java Spring Boot 后端
│   └── src/main/java/com/routerclaude/
│       ├── controller/           # REST API 控制器
│       ├── service/              # 业务逻辑层
│       ├── config/               # CCD 配置文件读写
│       ├── proxy/                # 模型转发代理服务器
│       └── model/                # 数据模型
└── docs/                         # 开发文档
```

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

