<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/RouterClaude-FF7A00?style=for-the-badge&logo=tauri&logoColor=white">
    <img src="https://img.shields.io/badge/RouterClaude-FF5500?style=for-the-badge&logo=tauri&logoColor=white" alt="RouterClaude" width="240">
  </picture>
</p>

<p align="center">
  <b>AI 模型代理 & 负载均衡 · 支持 CCD & CC CLI · 本地运行</b>
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
  <i>本地 AI 模型代理 · 智能负载均衡 · 多供应商统一管理 · CCD & CC CLI 一键配置</i>
</p>


---

## 为什么需要 RouterClaude？

Claude Code Desktop 要求所有模型名称必须以 `claude-` 开头（如 `claude-DeepSeek-V4-Flash`），但绝大多数模型供应商（DeepSeek、OpenAI-compatible 等）并不识别这种格式。每次手动改模型名不现实，直接在 CCD 里配原始模型名又无法通过校验。

RouterClaude 就是为了解决这个错位而生：

1. **接管 CCD 的 API 请求** — CCD 发送 `claude-DeepSeek-V4-Flash` 到本地代理
2. **自动去除前缀** — 代理剥离 `claude-`，还原为 `DeepSeek-V4-Flash`
3. **转发到真实供应商** — 使用正确的模型名调用供应商 API

同时提供可视化界面管理多个供应商配置，支持 **负载均衡** 在多个供应商之间智能分配请求。v1.2.0 起还支持 **Claude Code CLI** 的供应商配置管理，与 CCD 配置隔离。

---

## 核心功能

### 代理服务（`:8901`）

本地代理是 RouterClaude 的核心，所有 CCD / CC 的 API 请求都经过代理转发：

| 能力 | 说明 |
|---|---|
| **模型名转换** | 自动去除 `claude-` 前缀，还原为供应商真实模型名 |
| **SSE 流式透传** | 流式响应实时转发，零延迟体验 |
| **Token 认证** | 代理 Token 保护真实 API Key，CCD/CC 配置中只填代理 Token |
| **请求重试** | 5xx 错误或超时时自动重试，可配置重试次数和间隔 |
| **响应缓存** | 非流式请求基于 SHA-256 哈希缓存，减少重复调用 |
| **健康检查** | 定期探测供应商可用性，故障自动剔除 |

### 负载均衡

按客户端类型（CCD / CC）分别配置供应商分组，在多个供应商之间智能分配请求：

| 策略 | 行为 |
|---|---|
| **轮询（Round Robin）** | 按顺序轮流调用分组内的供应商 |
| **权重（Weighted）** | 按权重比例分配，如权重 2:1 则 A,A,B,A,A,B 循环 |
| **最低延迟（Lowest Latency）** | 自动选择响应最快的供应商 |

- **按客户端类型隔离** — CCD 和 CC 各自独立的供应商分组和策略
- **模型池** — 每个供应商条目可配置多个模型，LB 自动选择
- **故障转移** — 供应商不可用时自动跳过，选择下一个健康节点
- **Web 实时监控** — 代理日志和用量数据通过 WebSocket 实时推送，虚拟滚动高性能渲染

### 供应商管理

<table>
<tr>
  <td width="50%">
    <h4>📦 CCD 供应商管理</h4>
    可视化添加、编辑、删除、启用/禁用、拖拽排序模型供应商，内置主流预设模板
  </td>
  <td width="50%">
    <h4>🔧 CC CLI 供应商管理</h4>
    管理 Claude Code CLI 供应商配置，支持 API 模式切换、模型自动发现、1M 上下文
  </td>
</tr>
<tr>
  <td width="50%">
    <h4>📊 用量图表</h4>
    趋势折线图 + 供应商/模型占比饼图，按日/周/月统计 Token 消耗
  </td>
  <td width="50%">
    <h4>📋 日志搜索 & 过滤</h4>
    按模型、供应商、状态码筛选，关键词搜索，虚拟滚动高性能渲染
  </td>
</tr>
<tr>
  <td width="50%">
    <h4>📥 导入/导出</h4>
    供应商配置 JSON 导入导出，方便迁移和备份
  </td>
  <td width="50%">
    <h4>🔒 完全本地运行</h4>
    无云端依赖，中英日韩四语界面，支持自动更新检查
  </td>
</tr>
</table>

---

## 架构

```
    ┌───────────────────────────────────────────────────────────┐
    │                     Tauri 桌面壳                           │
    │   ┌──────────────────┐      ┌──────────────────────────┐  │
    │   │   React UI       │      │   Java 后端              │  │
    │   │   (WebView)      │◄────►│   (Spring Boot)          │  │
    │   └──────────────────┘ REST └───────┬──────────────────┘  │
    │                   + WebSocket :8900 │                      │
    └────────────────────────────────────┼──────────────────────┘
                                         │
                  ┌──────────────────────┼──────────────────────┐
                  │                      │                      │
                  ▼                      ▼                      ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │   CCD 配置文件    │  │  代理服务 :8901  │  │   供应商 API     │
        │  _meta.json      │  │                  │  │  DeepSeek        │
        │  {uuid}.json     │  │  模型名转换      │  │  Mimo            │
        └──────────────────┘  │  负载均衡        │  │  GLM / ...       │
                              │  认证 & 缓存     │◄─│                  │
                              │  重试 & 健康检查  │  └──────────────────┘
                              └──────────────────┘

   CCD ── POST /v1/messages ──► 代理 :8901 ── 负载均衡选择 ──► 供应商 API
                                 │
                                 ├── 去除 claude- 前缀
                                 ├── 按策略选择供应商 & 模型
                                 ├── Token 认证替换
                                 └── 重试 / 缓存 / 日志
```

### 请求流程

```
CCD 发送请求                    RouterClaude 代理                    供应商 API
    │                                │                                  │
    │  POST /v1/messages             │                                  │
    │  model: claude-DeepSeek-V4     │                                  │
    │  Authorization: proxy-token    │                                  │
    ├───────────────────────────────►│                                  │
    │                                │  1. 验证 proxy-token             │
    │                                │  2. 匹配供应商（单选/LB）         │
    │                                │  3. 去除 claude- 前缀            │
    │                                │  4. 替换为真实 API Key            │
    │                                │  5. 发送请求                     │
    │                                │─────────────────────────────────►│
    │                                │                                  │
    │                                │  ◄── SSE 流式响应 ──             │
    │                                │◄─────────────────────────────────│
    │  ◄── 实时透传 ──               │  6. 记录日志 & 用量              │
    │◄───────────────────────────────│  7. WebSocket 推送               │
```

### 配置目录结构

```
~/.routerclaude/
├── ccd/                  # CCD 配置文件（同步写入 CCD 目录）
│   ├── _meta.json        # 供应商注册表 + 激活状态
│   └── {uuid}.json       # 单个供应商配置
├── cli/                  # Claude Code CLI 配置文件
│   ├── _meta.json        # CLI 供应商注册表
│   └── {uuid}.json       # 单个 CLI 供应商配置
├── data/                 # 应用数据（持久化）
│   ├── logs.json         # 代理请求日志（最近 500 条）
│   └── usage.json        # Token 用量记录（最近 10000 条）
├── settings.json         # 全局设置（LB 配置、重试、缓存）
└── ccd-config/           # CCD settings.json（生成）
```

<details>
<summary><b>技术栈</b></summary>
<br>

| 层级 | 技术 |
|---|---|
| 前端 | React 18, TypeScript 5, Vite 6, Tailwind CSS 3 |
| 桌面壳 | Tauri 2 |
| 后端 | Java 25, Spring Boot 3.4 |
| 实时通信 | WebSocket（日志 & 用量推送） |
| 数据库 | 无（基于文件系统的 JSON 配置 + 环形缓冲区持久化） |
| 国际化 | i18next + react-i18next（中/英/日/韩） |
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

一键构建（推荐）：

```bash
pnpm build:release
```

这会依次执行：构建后端 JAR → 裁剪 JRE → 打包 MSI。

手动分步构建：

```bash
# 1. 构建后端 JAR
cd backend && mvn package -DskipTests

# 2. 裁剪最小 JRE（约 50MB，集成到安装包中，用户无需安装 Java）
jlink --no-header-files --no-man-pages --strip-debug --compress=zip-6 \
  --add-modules java.base,java.logging,java.xml,java.sql,java.naming,java.management,java.desktop,java.net.http,java.security.jgss,java.instrument,jdk.unsupported,jdk.httpserver \
  --output backend/target/jre

# 3. 构建安装包（.msi）
cd .. && pnpm tauri build
```

安装包内包含 React 前端静态资源、Spring Boot 后端 JAR、裁剪后的 JRE（~50MB）、Tauri 运行时。用户无需安装 Java 即可使用。

---

## 使用指南

### 添加供应商

1. 启动 RouterClaude
2. 点击 **+ 添加供应商**
3. 选择预设模板（如 DeepSeek）或选择自定义
4. 填写 API Key，可点击 **自动发现** 拉取模型列表
5. 点击 **创建**

### 配置负载均衡

1. 进入 **设置** → **负载均衡**
2. 开启负载均衡开关
3. 选择策略（轮询 / 权重 / 最低延迟）
4. 切换 CCD / CC 标签页，分别为不同客户端配置供应商分组
5. 点击 **添加供应商**，选择要加入分组的供应商
6. 为每个供应商条目选择参与负载均衡的模型
7. 如选择权重策略，拖动滑块设置各供应商权重
8. 点击 **保存**

### 在 CCD 中使用

启用供应商后，代理服务器 `127.0.0.1:8901` 开始转发请求：

1. 在 CCD 中将推理网关地址设为 `http://127.0.0.1:8901`
2. 选择以 `claude-` 开头的模型（如 `claude-DeepSeek-V4-Flash`）
3. CCD 发送请求到本地代理，代理自动去除前缀并转发到真实供应商 API
4. 如开启负载均衡，代理会按配置的策略在供应商分组中智能分配请求

### 查看日志和用量

切换到 **日志** 标签页查看代理请求记录（WebSocket 实时推送），切换到 **用量** 标签页查看 Token 消耗统计。数据在应用重启后自动恢复。

### 检查更新

切换到 **关于** 标签页，点击 **检查更新** 按钮。如有新版本，弹窗提示是否下载安装。

### 端口说明

| 端口 | 服务 | 说明 |
|---|---|---|
| `8900` | 管理 API | 前端调用的后端 REST API + WebSocket |
| `8901` | 代理服务 | CCD / CC 请求转发代理 |

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
| `POST` | `/api/providers/export` | 导出供应商配置 |
| `POST` | `/api/providers/import` | 导入供应商配置 |

### Claude Code CLI API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/claude-cli` | 获取所有 CLI 供应商 |
| `POST` | `/api/claude-cli` | 创建 CLI 供应商 |
| `PUT` | `/api/claude-cli/{id}` | 更新 CLI 供应商 |
| `DELETE` | `/api/claude-cli/{id}` | 删除 CLI 供应商 |
| `PATCH` | `/api/claude-cli/{id}/toggle` | 切换启用状态 |
| `POST` | `/api/claude-cli/{id}/test` | 测试连接 |
| `POST` | `/api/claude-cli/reorder` | 保存排序 |
| `POST` | `/api/claude-cli/discover` | 自动发现模型 |
| `POST` | `/api/claude-cli/export` | 导出配置 |
| `POST` | `/api/claude-cli/import` | 导入配置 |

### 负载均衡 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/lb/config` | 获取 LB 配置（策略、CCD/CC 分组） |
| `PUT` | `/api/lb/config` | 更新 LB 配置 |
| `GET` | `/api/lb/providers?type=ccd\|cc` | 获取可选供应商列表（含模型） |

### 代理 API（`:8901`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/v1/messages` | 转发 Claude Messages API 请求 |
| `POST` | `/v1/complete` | 转发 Claude Completions API 请求 |
| `GET` | `/v1/models` | 获取当前可用模型列表（LB 开启时返回分组内模型） |

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

### WebSocket（`:8900/ws`）

| 消息类型 | 数据 | 触发时机 |
|---|---|---|
| `proxy_log` | `{ timestamp, model, providerName, statusCode, latencyMs, isError }` | 每次代理请求完成 |
| `proxy_status` | `{ running, port, totalRequests, errorRate, startupError }` | 代理启动/停止 |
| `usage_update` | `{ totalTokens, promptTokens, completionTokens, requestCount }` | 用量数据变更 |

### 更新检查 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/update/check?currentVersion=1.3.0` | 检查 GitHub Releases 最新版本 |

### 设置 API（`:8900`）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/settings` | 获取全局设置 |
| `PUT` | `/api/settings` | 更新全局设置 |

---

## 项目结构

```
router-claude/
├── src/                          # React 前端
│   ├── components/               # UI 组件
│   │   ├── ProviderCard.tsx      # 供应商卡片（拖拽排序、标签、测试）
│   │   ├── ProviderForm.tsx      # 供应商表单（预设、API模式、自动发现）
│   │   ├── ClaudeCliCard.tsx     # CLI 供应商卡片
│   │   ├── ClaudeCliForm.tsx     # CLI 供应商表单（API模式、1M上下文）
│   │   ├── ClaudeCliPanel.tsx    # CLI 供应商管理面板
│   │   ├── LbPanel.tsx           # 负载均衡配置面板
│   │   ├── SettingsPanel.tsx     # 设置面板（LB、重试、缓存配置）
│   │   ├── LogPanel.tsx          # 代理日志面板（WebSocket + 虚拟滚动）
│   │   ├── UsagePanel.tsx        # Token 用量统计（折线图、饼图）
│   │   ├── AboutPanel.tsx        # 关于页面（版本信息、更新检查）
│   │   └── Toast.tsx             # Toast 弹窗组件
│   ├── hooks/                    # TanStack Query Hooks + WebSocket + 虚拟滚动
│   ├── data/                     # 预设供应商数据
│   ├── utils/                    # 工具函数（错误码翻译）
│   ├── i18n/                     # 中英日韩语言包
│   └── types/                    # TypeScript 类型定义
├── src-tauri/                    # Tauri 桌面壳
│   ├── src/main.rs               # 入口，管理 Java sidecar 生命周期
│   └── capabilities/             # Tauri 权限配置
├── backend/                      # Java Spring Boot 后端
│   └── src/main/java/com/routerclaude/
│       ├── controller/           # REST API 控制器（含 LB 配置）
│       ├── service/              # 业务逻辑（含 LoadBalancerService）
│       ├── config/               # 配置文件读写 + 数据持久化 + SettingsStore
│       ├── proxy/                # 模型转发代理服务器 + 日志
│       ├── websocket/            # WebSocket 事件推送
│       └── model/                # 数据模型
└── docs/                         # 开发文档
```

---

## 更新日志

### v1.3.0

- **负载均衡**：按客户端类型（CCD/CC）独立配置供应商分组，支持三种策略 — 轮询、权重（确定性加权轮询）、最低延迟
- **代理优化**：代理日志和用量数据通过 WebSocket 实时推送，替代 REST 轮询
- **虚拟滚动**：日志列表虚拟滚动渲染，500+ 条日志流畅滚动
- **健康检查**：定期探测供应商可用性，故障节点自动剔除

### v1.2.0

- **Claude Code CLI 支持**：管理 Claude Code CLI 供应商配置，与 CCD 配置隔离，支持 API 模式切换（OpenAI/Anthropic）、模型自动发现、1M 上下文模式
- **代理认证**：Token 认证机制，真实 API Key 仅存 RouterClaude，CCD/CC 配置使用代理 Token
- **代理重试**：5xx 错误或超时时自动重试，可配置重试次数和间隔
- **响应缓存**：非流式请求基于 SHA-256 哈希缓存，可配置 TTL 和最大条目数
- **配置导入/导出**：供应商配置 JSON 导入导出，方便迁移和备份
- **用量图表**：趋势折线图（今日/本周/本月）+ 供应商/模型占比饼图
- **日志搜索与过滤**：按模型、供应商、状态码筛选，关键词搜索
- **标签颜色系统**：10 色确定性哈希分配，标签视觉区分更清晰
- **设置面板**：代理重试和缓存配置，设置页内联导航（日志/用量/关于）
- **拖拽排序优化**：closestCorners 碰撞检测，放置位置更准确
- **启动速度优化**：Spring Boot 懒加载 + JMX 禁用，启动提速约 16%
- **配置校验增强**：逐字段内联错误提示，所有校验错误同时显示

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
