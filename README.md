# Writonyx - 下一个时代的笔记软件

默认中文说明。For English, see [English Version](#english).

## 中文

**Writonyx** 是一个面向 AI 时代的 HTML 原生笔记软件。它的长期目标不是再做一个 Markdown 编辑器，而是做下一代以 HTML 文档为核心的知识管理、创作和发布工作台。

> 当前版本：`0.0.2`
> 当前状态：开发者自用、自测、完善 BUG 中。还没有到正式可发版、可面向普通用户稳定分发的版本。

### 为什么做这个项目

我们认为笔记软件正在进入一个新的转折点。

过去十年，主流笔记工具大多围绕 Markdown 展开：纯文本、轻量、可迁移、适合程序员和知识工作者。但 AI 时代的内容形态正在快速变化。越来越多的 AI Agent、Coding Agent 和创作工具不再只生成 Markdown，而是直接生成 HTML 页面、交互式报告、本地仪表盘、可发布的网页结构和富媒体文档。

这带来两个非常明确的痛点。

### 痛点一：Markdown 笔记软件无法承载下一代 HTML 文档

Markdown 仍然有价值，但它正在被更复杂的 HTML 文档挤压。AI 生成的内容越来越像一个完整页面，而不是一段纯文本笔记：

- 有结构化标题、卡片、表格、图表和交互区域。
- 有可视化布局，而不是只有段落。
- 有可发布属性，可以直接变成网页、报告、知识库页面或分享链接。
- 有局部编辑需求，用户想改页面中的某一块内容，而不是改整篇源码。

但以前的笔记软件几乎都是 Markdown-first。它们擅长编辑 `.md` 文件，却没有真正把 HTML 当作一等公民。我们想做的是一个 **HTML-first / HTML-native 的核心笔记软件**，让用户默认看到渲染后的页面，而不是被迫面对 HTML 源码。

这就是 Writonyx 的第一条产品假设：

**AI 时代会出现一个以 HTML 为核心的 killer note app。我们想把它做出来。**

### 痛点二：AI Agent 生成的文档没有好的管理方案

今天很多人已经在高频使用 Codex、Claude Code、Cursor、Devin 类工具，以及各种本地或云端 AI Agent。它们会持续生成：

- Markdown 调研文档
- HTML 报告
- 本地 dashboard
- 项目说明页
- 代码分析页面
- 商业计划、PRD、竞品分析、研究报告

但这些文件往往散落在项目目录、临时输出目录、聊天上下文或下载文件夹里。它们没有统一的入口，没有优雅的目录级管理，也没有可靠的预览、搜索、版本、接管和发布流程。

Writonyx 的第二条产品假设是：

**AI Agent 生成的 HTML 和 Markdown 文档，会成为一个新的知识资产入口。用户需要一个专门的 app 来接管、整理、预览、编辑和发布这些资产。**

这个项目就是从这个入口切入：先接管 AI 生成的 HTML/MD 文件，再逐步演化成 HTML 原生的下一代笔记系统。

### 一期正在做什么

当前开源版本聚焦在本地优先、可验证、可接管的基础能力。

- **HTML 渲染优先**：用户默认看到渲染后的 HTML 页面，而不是 HTML 代码。
- **Obsidian 风格目录树**：左侧用 Vault tree 管理 HTML、Markdown 和本地服务资产。
- **AI 生成文档接管**：支持接管 Codex、Claude Code 或其他 Agent 生成的 HTML/Markdown 文件。
- **Markdown 管理与预览**：Markdown 可以进入 Vault，保留原始 `.md` 文件，同时以 HTML 页面形式预览。
- **Markdown 转 HTML**：Markdown 可以转换成新的受管理 HTML 资产，原始 Markdown 不被修改。
- **元素级编辑**：在渲染页面中选择具体 HTML 元素，对局部文案做手动编辑。
- **元素级 AI 编辑**：锚定具体元素，把 selector、tag 和选中文本作为 AI 编辑范围，避免 AI 改动整篇文档。
- **Source Guard**：任何写回源文件的动作都要先看 diff，再选择取消、另存副本或写回。
- **版本与回滚基础**：支持版本快照、diff 和回滚接口。
- **资产检查与导出基础**：检查缺失资源、外部资源、危险脚本，并支持静态包/Markdown 导出。
- **中英文 UI 与深浅色主题**：基础国际化和主题切换已经接入。
- **BYOK AI 配置**：开源版本不写死密钥，用户通过本地 `.env.local` 配置模型服务地址、模型名和 API Key。

### 未来计划

这个项目未来会围绕三个方向继续发展。

#### 下一期重点：Agent 可调用知识库

下一期我们会把 Writonyx 从“管理 AI 生成文档的本地 Vault”推进到“可被 AI Agent 直接调用的知识资产层”。

这个方向会借鉴 Ai 好记这类闭源互联网产品的精华：笔记不只是被人打开阅读，也应该能被 Codex、Claude Code、OpenClaw、Cursor 等 Agent 按权限检索、读取、总结和复用。但 Writonyx 的差异在于，它的核心资产不是传统纯文本笔记，而是 AI 时代大量出现的 HTML 页面、Markdown 文档、本地 dashboard、项目报告和可发布网页。

下一期计划包含：

- **Writonyx Skills / Agent Connector**：提供可一键接入 Agent 工具的技能包，让 Agent 能用自然语言搜索 Vault、读取文档摘要、获取大纲、调取渲染文本，并把新生成的 HTML/Markdown 注册进 Vault。
- **Local Personal API**：开源版优先提供本地个人 API，而不是云端强绑定开放平台。用户可以在本机生成访问 token，让自己的 Agent 或脚本调用 Vault。
- **细粒度权限 Scope**：至少区分 `vault:list`、`asset:read-summary`、`asset:read-rendered`、`asset:read-source`、`asset:search`、`asset:register`、`asset:export`、`asset:write-review`、`asset:write-apply` 等权限。
- **只读先行，写入受控**：第一阶段优先开放查询、读取、摘要、注册；涉及修改源文件的能力必须经过 Source Guard，以 diff review、另存副本、确认写回的方式完成。
- **Agent 场景模板**：沉淀项目复盘、周报/月报、学习计划、内容创作、跨文档追问、单篇快速回顾等高频模板，让 Writonyx 的 Vault 可以直接进入真实 AI 工作流。

1. **成为 HTML-native 笔记编辑器**

   - 更完整的所见即所得 HTML 编辑。
   - 更强的元素级选择、拖拽、重排和样式编辑。
   - HTML block / component 级管理。
   - 从 Markdown shortcut 过渡到 HTML-first 编辑体验。
   - 类似 Obsidian 的 backlinks、quick open、command palette 和插件生态。

2. **成为 AI Agent 文档资产管理器**

   - 更完整的 Agent Bridge。
   - 监听 Codex、Claude Code、Cursor 等工具生成的文档。
   - 自动识别 HTML、Markdown、本地 dashboard、报告和项目首页。
   - 自动生成摘要、标签、来源、版本快照和预览图。
   - 支持团队或项目级 Vault。

3. **成为 HTML 文档的发布与分享基础设施**

   - 云同步。
   - 云分享。
   - 静态网页发布。
   - 文档权限管理。
   - AI 托管式编辑、总结、翻译、重写和结构化。
   - 面向个人知识库、AI 工作流、研究报告、商业文档和项目文档的分享链路。

### 商业化方向

Writonyx 当前按开源模式开发，但它天然适合存在一个闭源/商业封装版本。

参照系上，Writonyx 会分成两条线看：

- **开源生态对标 Obsidian**：本地优先、用户拥有文件、目录树/Vault 心智、可扩展插件生态、适合开发者和重度知识工作者长期使用。
- **闭源互联网产品参考 Ai 好记这类 Agent-ready 笔记平台**：把笔记能力开放给 AI Agent，提供 Skill、API、权限、云同步、托管 AI 和自动化工作流，让笔记从静态记录变成可调用知识资产。

原因很简单：HTML-first 笔记软件比传统 Markdown 笔记软件更接近网页、知识库和可分享报告。它天然适合接入：

- 自动云同步
- 一键云分享
- 托管发布
- 团队协作
- 权限控制
- 云端开放 API
- 托管 Agent Skills / Connectors
- 托管 AI 模型
- 无需用户自行配置 API Key 的 AI 功能
- 面向企业或专业用户的模板、报告流和 Agent 文档管理

开源版本会坚持本地优先、BYOK、可审计、可自托管的方向；商业版本可以提供更顺滑的封装体验：不用配置环境变量、不用自己准备模型服务、不用自己处理同步和分享。

一句话：

**开源版本解决可信和可控，商业版本解决省心和规模化。**

### 当前版本边界

`0.0.2` 仍然是早期开发者版本：

- 适合开发者本地试用、自测和参与贡献。
- 不建议普通用户把它当作长期稳定资料库。
- 不保证数据结构未来不变。
- 不保证 UI/交互已经达到正式产品发版标准。
- 目前仍在持续完善 BUG、交互细节、桌面端稳定性和真实 Agent 工作流。

### 安装

```bash
npm install
```

### 配置 AI

复制配置模板：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```text
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_API_KEY=replace-with-your-api-key
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048
```

不要提交真实 API Key。`.env.local` 已被 git 忽略。

### 运行

Web/dev 模式：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5178
```

桌面开发模式：

```bash
npm run tauri:dev
```

Release 桌面构建：

```bash
npm run tauri:build
```

macOS app 构建产物位于：

```text
src-tauri/target/release/bundle/macos/Writonyx.app
```

开源仓库只上传源码、文档、配置模板和测试，不上传打包产物。

### 测试

```bash
npm run verify
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

当前最近验证状态：

- `npm run verify`: 通过，44 个测试文件 / 188 条测试。
- `cargo check --manifest-path src-tauri/Cargo.toml`: 通过，仅有非阻塞 Rust unused warnings。
- `npm run tauri:build`: 通过，已生成 `.app`。
- Browser smoke: 通过，使用隔离 `VAULT_DIR` 验证渲染预览、相对目录树、Markdown 转 HTML、元素级 Source Guard review。
- DeepSeek live smoke: 通过，使用用户本地 `.env.local` 配置，未输出 API Key。

### 项目结构

```text
bridge/             Agent Bridge, inbox, CLI, service/export/version helpers
docs/               PRD mapping, technical design, security review, test report
src/                React app, features, local server, shared types
src-tauri/          Tauri desktop shell and Rust native commands
tests/              Unit, integration, fixtures, and desktop contract tests
```

### 安全说明

- API Key 不写死在源码里。
- 前端只读取安全 AI 状态，不接收密钥原文。
- `.env.local`、运行数据、测试 Vault、构建产物都不会提交。
- Source Guard 会在写回源文件前展示 diff，并要求用户显式决策。

---

## English

# Writonyx - The Note-Taking App for the Next Era

**Writonyx** is an HTML-native note app for the AI era. The long-term goal is not to build yet another Markdown editor. The goal is to build the next core workspace for HTML documents, AI-generated reports, local dashboards, and publishable knowledge assets.

> Current version: `0.0.2`
> Current status: developer self-use, self-testing, and active bug fixing. This is not yet a formal stable release for general users.

### Why This Project Exists

We believe note-taking software is entering a new phase.

For the past decade, many knowledge tools were built around Markdown: plain text, portable, lightweight, and friendly to developers. But AI-generated content is changing the shape of documents. Agents and coding assistants increasingly produce HTML pages, interactive reports, dashboards, publishable structures, and visual documents rather than only `.md` files.

That creates two major problems.

### Problem 1: Markdown-first note apps are not enough for HTML-native documents

Markdown is still useful, but it is no longer enough for many AI-era documents. AI-generated output often looks like a complete page:

- structured headings, cards, tables, charts, and panels
- visual layout rather than only paragraphs
- publishable web-like documents
- local editing needs at the element or block level

Most existing note apps are Markdown-first. They are good at editing `.md`, but they do not treat HTML as a first-class document format.

Writonyx starts from a different assumption:

**The AI era needs an HTML-first killer note app. We want to build it.**

### Problem 2: AI Agent outputs do not have a good management layer

People are already using Codex, Claude Code, Cursor, Devin-like tools, and many other AI Agents to generate documents and project artifacts. These tools create:

- Markdown research notes
- HTML reports
- local dashboards
- project pages
- code analysis documents
- PRDs, business plans, competitor analysis, and research reports

But those files are scattered across project folders, temporary outputs, chat contexts, and downloads. There is no elegant app that can take over those generated HTML/Markdown assets, organize them into a directory-level Vault, preview them, version them, edit them, and eventually publish them.

Writonyx starts with this market entry point:

**Take over AI-generated HTML and Markdown documents first, then evolve into the next-generation HTML-native note system.**

### What v0.0.2 Is Building

The current open-source version focuses on local-first, testable, document-takeover fundamentals.

- **Render-first HTML reading**: users see the rendered page by default, not raw HTML source.
- **Obsidian-style Vault tree**: HTML, Markdown, and service assets are organized in a left-side tree.
- **AI-generated document takeover**: Codex, Claude Code, or other agent outputs can be registered into the Vault.
- **Markdown management and preview**: Markdown can be managed as a Vault asset while preserving the original `.md` source.
- **Markdown to HTML conversion**: Markdown can become a new managed HTML asset without mutating the original file.
- **Element-level manual editing**: select a rendered HTML element and edit only that local text.
- **Element-level AI editing**: anchor an AI edit to a specific selector, tag, and selected text.
- **Source Guard**: source writes require a diff review and an explicit cancel / save-as / write-back decision.
- **Version foundations**: snapshots, diffs, and rollback interfaces.
- **Asset checks and export foundations**: missing assets, external resources, dangerous scripts, static package export, and Markdown export.
- **Chinese/English UI and dark/light themes**.
- **BYOK AI configuration**: the open-source version uses local `.env.local` configuration and never hardcodes API keys.

### Roadmap

#### Next Focus: Agent-Callable Knowledge Base

The next product phase will move Writonyx from a local Vault for AI-generated documents into an agent-callable knowledge asset layer.

This direction borrows the strongest idea from closed-source internet products such as Ai Haoji: notes should not only be opened and read by humans; they should also be searchable, readable, summarizable, and reusable by Agents such as Codex, Claude Code, OpenClaw, Cursor, and other AI workflows. Writonyx differs by treating AI-era HTML pages, Markdown documents, local dashboards, project reports, and publishable web documents as first-class assets, not only traditional text notes.

Planned next-phase capabilities include:

- **Writonyx Skills / Agent Connector**: one-click Agent integration packages so Agents can search the Vault, read summaries, fetch outlines, access rendered text, and register newly generated HTML/Markdown documents.
- **Local Personal API**: the open-source edition should start with a local API instead of a cloud-only open platform. Users can generate local access tokens for their own Agents and scripts.
- **Fine-grained permission scopes**: expected scopes include `vault:list`, `asset:read-summary`, `asset:read-rendered`, `asset:read-source`, `asset:search`, `asset:register`, `asset:export`, `asset:write-review`, and `asset:write-apply`.
- **Read-only first, controlled writes later**: the first phase should prioritize search, read, summarize, and register flows. Any source modification must pass through Source Guard with diff review, save-as-copy, and explicit write-back confirmation.
- **Agent workflow templates**: project retrospectives, weekly/monthly reports, study plans, content drafting, cross-document Q&A, and single-document quick review templates that let the Vault participate in real AI work.

1. **Become an HTML-native note editor**

   - richer WYSIWYG HTML editing
   - stronger element selection, drag/reorder, and style editing
   - HTML block/component management
   - Markdown shortcuts where useful, but HTML-first editing overall
   - backlinks, quick open, command palette, and plugin-style workflows

2. **Become an AI Agent document asset manager**

   - stronger Agent Bridge integrations
   - watch outputs from Codex, Claude Code, Cursor, and other tools
   - automatically identify HTML, Markdown, local dashboards, reports, and project pages
   - generate summaries, tags, source metadata, snapshots, and previews
   - support project-level or team-level Vaults

3. **Become publishing and sharing infrastructure for HTML documents**

   - cloud sync
   - cloud sharing
   - static publishing
   - permission control
   - hosted AI editing, summarization, translation, and rewriting
   - workflows for personal knowledge bases, AI-generated reports, business documents, and project documentation

### Commercial Direction

Writonyx is open source first, but it naturally supports a future closed-source/commercial wrapper.

Writonyx uses two different benchmark lines:

- **Open-source ecosystem benchmark: Obsidian**. Local-first ownership, user-controlled files, Vault/tree mental model, extensibility, and long-term trust for developers and serious knowledge workers.
- **Closed-source internet product reference: Ai Haoji-style Agent-ready note platforms**. Notes become callable knowledge assets through Skills, APIs, permissions, cloud sync, managed AI, and automated workflows.

Because HTML-first notes are closer to web pages, reports, and shareable knowledge assets than traditional Markdown notes, the product naturally fits:

- automatic cloud sync
- one-click cloud sharing
- hosted publishing
- team collaboration
- permissions
- cloud open APIs
- managed Agent Skills / Connectors
- managed AI models
- AI features that do not require users to configure their own API keys
- professional templates, report workflows, and AI Agent document management

The open-source version should remain local-first, BYOK, auditable, and self-hostable. A commercial version can provide a smoother managed experience: no environment variables, no model setup, no sync setup, and no sharing infrastructure to maintain.

In short:

**Open source provides trust and control. A commercial wrapper can provide convenience and scale.**

### Current Release Boundary

`0.0.2` is still an early developer version:

- Suitable for local developer testing and contribution.
- Not recommended yet as a long-term stable personal knowledge base.
- Data structures may still change.
- UI and interaction quality are still being refined.
- Agent workflows, desktop stability, and edge cases are still under active testing.

### Install

```bash
npm install
```

### Configure AI

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```text
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_API_KEY=replace-with-your-api-key
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048
```

Do not commit real API keys. `.env.local` is ignored by git.

### Run

Web/dev mode:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5178
```

Desktop dev mode:

```bash
npm run tauri:dev
```

Release desktop build:

```bash
npm run tauri:build
```

The macOS app is generated under:

```text
src-tauri/target/release/bundle/macos/Writonyx.app
```

Build artifacts are not intended to be committed to the open-source repository.

### Test

```bash
npm run verify
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

Latest verified status:

- `npm run verify`: passed, 44 test files / 188 tests.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed with non-blocking Rust unused warnings.
- `npm run tauri:build`: passed, `.app` bundle generated.
- Browser smoke: passed with isolated `VAULT_DIR`; confirmed rendered preview, relative Vault tree, Markdown conversion, and element-level Source Guard review.
- DeepSeek live smoke: passed through ignored local `.env.local`; API key was not printed.

### Project Structure

```text
bridge/             Agent Bridge, inbox, CLI, service/export/version helpers
docs/               PRD mapping, technical design, security review, test report
src/                React app, features, local server, shared types
src-tauri/          Tauri desktop shell and Rust native commands
tests/              Unit, integration, fixtures, and desktop contract tests
```

### Security Notes

- API keys are never hardcoded.
- Frontend only receives safe AI status, not the key value.
- `.env.local`, runtime data, test Vaults, and build outputs are ignored.
- Source Guard protects source write-back with review and explicit decisions.
