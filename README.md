# HTML Native Notes

Status: PRD desktop reset in progress.

HTML Native Notes is being rebuilt as the PRD-defined macOS desktop AI HTML Vault app. The existing React/Fastify web app in this repository is a prototype slice only; it is not the complete product and must not be treated as PRD-complete.

Current authoritative planning docs:

- `docs/TECHNICAL_DESIGN.md`
- `docs/PRD_REQUIREMENTS_MATRIX.md`
- `docs/PRD_GAP_AUDIT.md`
- `docs/superpowers/plans/2026-06-26-prd-desktop-app.md`

The target product is a local-first macOS desktop workbench for AI-generated HTML documents, Markdown notes, and local service assets, with Source Guard, Agent Bridge, versioning, Markdown-style editing, service start/stop, asset checks, export, and publish workflows.

## Current Gate

The PRD recommends Tauri. This machine currently has Node/npm but does not have `rustc` or `cargo` in PATH, so desktop implementation cannot be built and self-tested until one of these is chosen:

- install Rust toolchain for this user account, then proceed with Tauri
- explicitly switch to the Electron fallback

No real API key should be committed. Use ignored local config only.

## Prototype Features

The current prototype includes the following web-only capabilities. They are useful reference material, not final scope.

## Features

- Local Fastify + React app on `127.0.0.1`.
- HTML source editor with live sanitized iframe preview.
- Local filesystem note storage under `data/`.
- Create, open, save, duplicate, and delete notes.
- User-configured OpenAI-compatible AI provider.
- AI actions: summarize, rewrite, outline, generate section, and clean HTML.
- Secret-safe AI status API.
- Prototype Vault home for bridge-registered HTML assets, including search/filter/list/card views, thumbnail generation, read-only preview, and a Source Guard preview-source edit review panel.
- Unit, integration, and Playwright E2E tests.

## Requirements

- Node.js 20 or newer.
- npm.

## Install

```bash
npm install
```

## Configure AI

Copy the example:

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

`.env.local` is gitignored. Do not commit real API keys.

## Run

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5178
```

## Use

1. Enter a note title.
2. Click the create icon.
3. Edit HTML in the source pane.
4. Check the preview pane.
5. Click Save.
6. Configure AI in `.env.local` to enable AI actions.

## Test

```bash
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=moderate
node scripts/test-ai-config.mjs
```

Playwright browsers may need one-time installation:

```bash
npx playwright install chromium
```

## Project Structure

```text
src/
  app/              React app shell
  features/         Notes, editor, preview, Vault, AI, settings UI
  server/           Fastify server, routes, storage, AI client
  shared/           Shared API client and TypeScript types
bridge/             Agent Bridge, Vault intake, Source Guard, thumbnails, services
tests/
  unit/             Unit and component tests
  integration/      Fastify API tests
  e2e/              Playwright browser tests
docs/
  TECHNICAL_DESIGN.md
  TEST_REPORT.md
  SECURITY_REVIEW.md
  superpowers/
```

## UI Quality Rule

All page interaction, UI, and visual polish changes should be treated as product-design work. The default direction is a polished professional editor experience: clear, durable, restrained, and pleasant enough for daily use.

## Development Notes

- Runtime notes are generated under `data/` and are gitignored.
- Production build output goes to `dist/` and is gitignored.
- Development Vite watch ignores `data/` so note saves do not reload the app.
- Fastify owns `/api/*`; Vite serves the frontend.

## FAQ

**Does the browser see my API key?**  
No. The frontend only sees a safe configured/not-configured status. AI calls go through the local backend.

**Can I use another OpenAI-compatible provider?**  
Yes. Change `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`.

**Where are notes stored?**  
In `data/notes/` with metadata in `data/metadata.json`.

**Why does preview strip scripts?**  
The preview is intentionally sandboxed for v0. HTML notes should be portable and readable without executing arbitrary scripts.
