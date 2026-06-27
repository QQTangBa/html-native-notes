# HTML Native Notes

Local-first macOS desktop app for AI-generated HTML notes, rendered HTML reading, Obsidian-style Vault navigation, Source Guard review, Agent Bridge intake, version snapshots, local export, and user-configured AI.

中文说明见下方「中文」部分。

## Highlights

- Tauri + React desktop app.
- Render-first HTML note reading: users see the rendered page by default, not raw HTML source.
- Obsidian-style left Vault tree with folder and note rows.
- English / Chinese UI switch.
- Dark / light theme switch.
- Agent Inbox for AI/agent-generated HTML and Markdown registration.
- Markdown notes can be managed in the Vault, previewed as rendered HTML, and converted into managed HTML assets.
- Rendered HTML elements can be selected for scoped manual edits or scoped AI edits, then reviewed through Source Guard.
- BYOK OpenAI-compatible AI configuration through local env only.
- Source Guard diff workflow before write-back.
- Version timeline, rollback hooks, asset integrity scan, package/Markdown export.

## Requirements

- macOS.
- Node.js 20+.
- npm.
- Rust toolchain for desktop builds (`cargo`, `rustc`).

## Install

```bash
npm install
```

## Configure AI

Copy the example file:

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

## Run

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
src-tauri/target/release/bundle/macos/HTML Native Notes.app
```

Build artifacts are not intended to be committed to the open-source repository.

## Use

1. Open the app.
2. Use the language and theme controls in the top-right corner.
3. Browse the Vault from the left tree.
4. Select an HTML or Markdown note to read the rendered page.
5. Convert Markdown notes into HTML assets when you want HTML export or element-level editing.
6. Select a rendered HTML element for scoped manual or AI edits, then review the diff before saving.
7. Configure AI in `.env.local` before using AI features.

## Test

```bash
npm run verify
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

Current verified status:

- `npm run verify`: passed, 44 test files / 188 tests.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed with non-blocking Rust unused warnings.
- `npm run tauri:build`: passed, `.app` bundle generated.
- Desktop/browser smoke: passed with isolated `VAULT_DIR`; confirmed rendered preview, relative Vault tree, Markdown conversion, element-level Source Guard review, English/Chinese switching, and dark/light theme switching.

## Project Structure

```text
bridge/             Agent Bridge, inbox, CLI, service/export/version helpers
docs/               PRD mapping, technical design, security review, test report
src/                React app, features, local server, shared types
src-tauri/          Tauri desktop shell and Rust native commands
tests/              Unit, integration, fixtures, and desktop contract tests
```

## Security Notes

- API keys are never hardcoded.
- Frontend only receives safe AI status, not the key value.
- Source Guard protects source write-back with review and explicit decision.
- Build output, runtime data, Vault test results, and Tauri target output are ignored.

## 中文

HTML Native Notes 是一个本地优先的 macOS 桌面笔记软件，用来管理 AI 生成的 HTML 页面、本地仪表盘、Markdown/HTML 笔记和可导出的静态资产。

核心体验：

- 用户默认看到 HTML 渲染后的页面，而不是 HTML 源码。
- 左侧是类似 Obsidian 的目录树，用来管理 Vault。
- 支持中文 / English 切换。
- 支持深色 / 浅色主题。
- 支持接管 AI 生成的 HTML 和 Markdown；Markdown 可以以渲染页面预览，也可以转换成受管理的 HTML 资产。
- 支持在渲染页面里选择具体 HTML 元素，进行局部手动编辑或局部 AI 编辑，然后走 Source Guard 审查。
- AI 接入采用用户自行配置：`AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY` 等都放在本地 `.env.local`，不会写死在代码里。
- Agent Inbox 可以接收 AI/Agent 生成的 HTML 和 Markdown 资产。
- Source Guard 在写回源文件前提供审查和决策。

常用命令：

```bash
npm install
npm run verify
npm run tauri:build
```

配置 AI：

```bash
cp .env.example .env.local
```

然后在 `.env.local` 中填写你自己的模型服务地址、模型名和 API Key。不要提交真实密钥。

打包产物位于：

```text
src-tauri/target/release/bundle/macos/HTML Native Notes.app
```

开源仓库只上传源码、文档、配置模板和测试，不上传打包产物。
