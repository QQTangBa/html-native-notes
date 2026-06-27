# PRD Desktop Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current TypeScript/Web fallback prototype into the PRD-defined macOS desktop AI HTML Vault application and verify the full V1 acceptance flow in the opened desktop app.

**Architecture:** Keep the React workbench as the renderer, but move trusted filesystem, source-guard, version, import, service, asset, export, inbox, and desktop launch operations behind Tauri/Rust command boundaries. TypeScript bridge modules remain useful as reference and fallback, but PRD completion requires native command coverage and desktop UI flows.

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Fastify fallback API, Vitest, Playwright, Tauri desktop launch checks, DeepSeek/OpenAI-compatible BYOK provider, `.htmlvault` local metadata.

---

## File Structure Map

- `src-tauri/src/main.rs`: current trivial Tauri entrypoint; must become command registration root.
- `src-tauri/src/commands/*.rs`: new Rust command modules for vault, inbox, source guard, versions, services, import, assets, export, settings.
- `src-tauri/src/core/*.rs`: new Rust core modules with no UI dependency.
- `src/shared/desktopBridge.ts`: new renderer bridge that calls Tauri commands when available and falls back to HTTP only in web/dev mode.
- `src/app/App.tsx`: app orchestration; must use desktop bridge rather than directly assuming Web API.
- `src/features/vault/VaultHome.tsx`: desktop Vault shell; must add inbox, import, direct edit, version screenshot hint, asset repair, publish states.
- `src/features/editor/*`: replace textarea-only editor with Markdown-first editing path.
- `bridge/*`: keep for CLI/HTTP/agent fallback; add MCP server and align with Rust/native store contracts.
- `tests/integration/desktop-contract/*`: command contract tests that inspect Tauri config/permissions and, once Rust exists, run Rust tests.
- `tests/e2e/desktop/*.spec.ts`: desktop-opened acceptance flows.
- `test-fixtures/`: generated 100 mixed files, 30 Markdown notes, service dashboards, broken assets, external edit fixtures.
- `test-results/`: evidence folders required by `docs/PRD_REQUIREMENTS_MATRIX.md`.

## Task 1: Rust/Tauri Environment Gate

**Files:**
- Modify: `docs/TEST_REPORT.md`
- Modify: `docs/PRD_REQUIREMENTS_MATRIX.md`
- Test: shell evidence

- [ ] **Step 1: Check Rust availability**

Run:

```bash
which rustc || true
which cargo || true
rustc --version || true
cargo --version || true
```

Expected before install: `rustc not found`, `cargo not found`.

- [ ] **Step 2: If Rust missing, ask for explicit approval**

Ask the user to approve installing Rust because it writes to user-level toolchain directories. Do not install without approval.

- [ ] **Step 3: After approval, install and verify**

Run the approved install command, then:

```bash
rustc --version
cargo --version
npm run tauri:build
```

Expected: Rust versions print and Tauri produces a macOS `.app`.

- [ ] **Step 4: Commit environment docs only**

```bash
git add docs/TEST_REPORT.md docs/PRD_REQUIREMENTS_MATRIX.md
git commit -m "docs: record tauri environment readiness"
```

## Task 2: Desktop Bridge Boundary

**Files:**
- Create: `src/shared/desktopBridge.ts`
- Modify: `src/app/App.tsx`
- Test: `tests/unit/desktopBridge.test.ts`

- [x] **Step 1: Write failing bridge test**

Test that `desktopBridge.listVaultLibrary()` calls `window.__TAURI__.core.invoke("vault_list_library")` when available and falls back to `apiClient.listVaultLibrary()` otherwise.

- [x] **Step 2: Implement bridge**

Expose typed methods mirroring current `apiClient`: library, preview, thumbnails, source guard, versions, services, assets, exports, diary, AI status.

- [x] **Step 3: Wire App**

Replace direct app-level `apiClient` calls with `desktopBridge`. Keep individual API client methods for web fallback.

- [x] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/desktopBridge.test.ts tests/unit/App.test.tsx
npm run typecheck
```

- [x] **Step 5: Commit**

```bash
git add src/shared/desktopBridge.ts src/app/App.tsx tests/unit/desktopBridge.test.ts
git commit -m "feat: add renderer desktop bridge boundary"
```

Checkpoint evidence: `desktopBridge` now maps renderer operations to explicit Tauri command names, falls back to HTTP when `__TAURI__` is unavailable, and falls back on missing-command errors from the transitional Tauri shell. `App` now uses `desktopBridge` instead of importing `apiClient` directly.

## Task 3: Native Vault Core Commands

**Files:**
- Create: `src-tauri/src/core/vault.rs`
- Create: `src-tauri/src/commands/vault.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/core/vault.rs` Rust unit tests and `tests/unit/desktopScaffold.test.ts`

- [ ] **Step 1: Write Rust tests**

Tests must prove manifest read/write, safe asset id validation, source path canonicalization, source hash preservation, and list/search/filter behavior.

- [ ] **Step 2: Implement core**

Implement `VaultManifest`, `VaultAsset`, `read_manifest`, `write_manifest`, `list_library`, `register_html_asset`, `read_asset_source`.

- [ ] **Step 3: Register Tauri commands**

Commands:

```rust
vault_list_library
vault_register_html_asset
vault_read_asset_source
vault_generate_thumbnails
```

Checkpoint evidence: Rust source now includes native Vault list/source commands plus Source Guard review/apply commands. Source Guard source has readable diff generation, explicit cancel/save-as/write-back decisions, source hash checks, and canonical Vault boundary checks for source/save-as paths. `npm run test:desktop:contract` covers this source/registration contract; Cargo verification remains pending until Rust is available.

- [ ] **Step 4: Verify**

Run:

```bash
cd src-tauri && cargo test
npm run test:desktop:contract
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src src-tauri/Cargo.toml tests/unit/desktopScaffold.test.ts
git commit -m "feat: add native vault command core"
```

## Task 4: Agent Bridge MCP + Inbox Desktop UI

**Files:**
- Create: `bridge/mcp/server.ts`
- Create: `src/features/bridge/InboxPanel.tsx`
- Create: `src-tauri/src/core/inbox.rs`
- Create: `src-tauri/src/commands/inbox.rs`
- Modify: `src/features/vault/VaultHome.tsx`
- Test: `tests/integration/bridge/mcpServer.test.ts`, `tests/unit/InboxPanel.test.tsx`

- [x] **Step 1: Add failing MCP server tests**

Tests must cover `registerHtmlAsset`, `registerWebService`, `searchVault`, `createNote`, `snapshot`, `publish`, and `importExisting` tool schemas.

- [x] **Step 2: Add failing inbox UI tests**

Tests must render pending offline requests, dedupe by request id/source hash, confirm registration, and dismiss invalid requests.

Checkpoint evidence: `tests/unit/InboxPanel.test.tsx` and `tests/unit/VaultHome.test.tsx` now cover a React Agent Inbox review panel for pending requests, duplicate and invalid-line counters, row busy state, empty state, and Vault sidebar confirm/dismiss event forwarding. Native startup inbox loading and Rust/Tauri inbox commands remain pending.

- [ ] **Step 3: Implement MCP server**

Use the official MCP TypeScript SDK pattern already planned by the PRD. Keep stdio transport first.

Checkpoint evidence: `bridge/mcp/server.ts` now exposes the seven PRD V1 tool definitions and a tested local tool-call dispatcher for `registerHtmlAsset`, `registerWebService`, `searchVault`, `createNote`, `snapshot`, `publish`, and `importExisting`. Official MCP SDK stdio transport remains pending because adding the SDK is a project dependency change.

- [ ] **Step 4: Implement desktop inbox commands**

Read from app support inbox and Vault `.htmlvault/inbox/requests.jsonl`; normalize, dedupe, and expose pending items to renderer.

Checkpoint evidence: non-Rust fallback path now covers Vault `.htmlvault/inbox/requests.jsonl` through `/api/agent/inbox`, `desktopBridge` command boundaries, and App startup rendering with confirm/dismiss actions. Rust source now includes `src-tauri/src/core/inbox.rs` and `src-tauri/src/commands/inbox.rs` for app-support + Vault inbox path merge, list, confirm, dismiss, source-hash checked intake, and command registration. Cargo verification and launched Tauri flow remain pending until Rust is available.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test -- tests/integration/bridge/mcpServer.test.ts tests/unit/InboxPanel.test.tsx tests/unit/VaultHome.test.tsx
cd src-tauri && cargo test
```

- [ ] **Step 6: Commit**

```bash
git add bridge/mcp src/features/bridge src-tauri/src tests/integration/bridge/mcpServer.test.ts tests/unit/InboxPanel.test.tsx
git commit -m "feat: add mcp bridge and desktop inbox review"
```

## Task 5: Fixture-Scale Import

**Files:**
- Create: `scripts/generate-prd-fixtures.mjs`
- Create: `test-fixtures/mixed100/`
- Create: `test-fixtures/markdown30/`
- Create: `src/features/import/ImportWizard.tsx`
- Create: `src-tauri/src/core/importer.rs`
- Test: `tests/integration/fixtures/mixed100.test.ts`, `tests/integration/fixtures/markdown30.test.ts`

- [x] **Step 1: Generate deterministic fixtures**

Create 100 mixed HTML/Markdown/project fixtures and 30 Markdown notes with frontmatter, images, wikilinks, tags, folders, and code blocks.

- [ ] **Step 2: Write failing scale tests**

Tests must hash all source files before import, run import, assert sources unchanged, assert at least 95 mixed files open/search/preview, and assert 30 Markdown notes preserve required metadata.

Checkpoint evidence: `scripts/generate-prd-fixtures.mjs` creates the deterministic fixture sets, and `tests/integration/fixtures/prdFixtures.test.ts` proves 30 Markdown notes convert without source mutation plus 70 importable HTML/project index files register into the current TS Vault library. The full 95/100 open-search-preview acceptance and native import wizard remain pending.

- [ ] **Step 3: Implement import wizard and native importer**

Show candidates, templates, warnings, service detection, source hashes, and confirm import.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/integration/fixtures/mixed100.test.ts tests/integration/fixtures/markdown30.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add scripts test-fixtures src/features/import src-tauri/src tests/integration/fixtures
git commit -m "feat: add fixture-scale import workflow"
```

## Task 6: Markdown-First Editor

**Files:**
- Create: `src/features/editor/MarkdownHtmlEditor.tsx`
- Create: `src/features/editor/markdownCommands.ts`
- Create: `src/features/editor/backlinkIndex.ts`
- Modify: `src/app/App.tsx`
- Test: `tests/unit/MarkdownHtmlEditor.test.tsx`, `tests/unit/backlinkIndex.test.ts`

- [ ] **Step 1: Write failing editor tests**

Tests must cover headings, lists, tasks, quote, code block, link, image, `[[page]]`, tags, quick open, and backlink creation.

- [ ] **Step 2: Implement Markdown command model**

Use a proven editor stack if dependencies are approved; otherwise implement an incremental command model with explicit tests before adding packages.

- [ ] **Step 3: Persist as HTML Profile**

Saving must write HTML with metadata/profile/backlinks and must preserve source guard behavior for imported originals.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/MarkdownHtmlEditor.test.tsx tests/unit/backlinkIndex.test.ts tests/unit/App.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/app/App.tsx tests/unit/MarkdownHtmlEditor.test.tsx tests/unit/backlinkIndex.test.ts
git commit -m "feat: add markdown-first html editor"
```

## Task 7: Page-In-Place Editing

**Files:**
- Create: `src/features/preview/editOverlay.ts`
- Modify: `src/features/vault/VaultHome.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/unit/pageEditOverlay.test.ts`, `tests/unit/VaultHome.test.tsx`

- [ ] **Step 1: Write failing overlay tests**

Tests must open preview, click Edit, select text node, edit it, exit, then see diff/write/save-as/cancel.

- [ ] **Step 2: Implement runtime overlay**

Do not inject persistent code into original HTML. Use iframe runtime DOM editing only.

- [ ] **Step 3: Wire snapshot and Source Guard**

Exiting edit mode creates a snapshot reason and routes changes through diff gate.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/pageEditOverlay.test.ts tests/unit/VaultHome.test.tsx tests/unit/App.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/features/preview src/features/vault src/app tests/unit/pageEditOverlay.test.ts
git commit -m "feat: add page-in-place edit overlay"
```

## Task 8: External Edit Watcher + Version Recovery

Checkpoint evidence before native watcher work: Rust source now includes `src-tauri/src/core/version_store.rs` and `src-tauri/src/commands/version_store.rs` for native list/create/diff/rollback command boundaries. The source covers safe `asset_*` IDs, snapshot content realpath containment under `.htmlvault/versions/<assetId>/`, source path Vault containment before snapshot/rollback, source/content diff, DOM summary, and rollback hash response. `npm run test:desktop:contract` covers this source/registration contract; Cargo verification and launched Tauri flow remain pending until Rust is available.

**Files:**
- Create: `src-tauri/src/core/watcher.rs`
- Modify: `bridge/watch/fileWatcher.ts`
- Modify: `bridge/vault/versionStore.ts`
- Test: `tests/integration/bridge/externalEditVersion.test.ts`

- [x] **Step 1: Write failing external edit test**

Test imports HTML, creates baseline, mutates file externally, watcher snapshots it, UI/API diff can compare, rollback restores.

- [x] **Step 2: Implement watcher-to-version pipeline**

Debounce writes, group by asset, record author/source/reason, compute screenshot hint placeholder.

Checkpoint evidence: `bridge/vault/externalEditWatcher.ts` now scans registered TS Vault HTML assets and creates exactly one `external-agent-edit` snapshot when the current source hash differs from the latest snapshot. `createExternalEditVersionWatcher` debounces filesystem events and polling into that snapshot pipeline. Rust watcher, UI diff flow, rollback proof from that flow, and screenshot hints remain pending.

- [x] **Step 3: Verify**

Run:

```bash
npm run test -- tests/integration/bridge/externalEditVersion.test.ts tests/integration/bridge/versionStore.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src bridge/watch bridge/vault tests/integration/bridge/externalEditVersion.test.ts
git commit -m "feat: snapshot external html edits"
```

## Task 9: Asset Localization and Repair

**Files:**
- Modify: `bridge/assets/scanner.ts`
- Create: `bridge/assets/localizer.ts`
- Modify: `src/features/vault/VaultHome.tsx`
- Test: `tests/integration/bridge/assetLocalizer.test.ts`, `tests/unit/VaultHome.test.tsx`

- [ ] **Step 1: Write failing localization tests**

Tests must copy local missing-fixable assets into managed package, leave original source unchanged unless write-back confirmed, and mark external/unpublishable resources.

- [ ] **Step 2: Implement localizer**

Write only to `.htmlvault/assets/<assetId>/` or export package unless user confirms source rewrite.

- [ ] **Step 3: Add repair UI**

Show missing, external, dangerous, blocked, localize, replace, delete, safe preview.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/integration/bridge/assetLocalizer.test.ts tests/unit/VaultHome.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add bridge/assets src/features/vault tests/integration/bridge/assetLocalizer.test.ts
git commit -m "feat: add asset localization workflow"
```

## Task 10: Publish/Public Link Adapter

**Files:**
- Create: `bridge/publish/staticProvider.ts`
- Create: `src/features/publish/PublishPanel.tsx`
- Create: `src/server/routes/publish.ts`
- Test: `tests/integration/publish.test.ts`, `tests/unit/PublishPanel.test.tsx`

- [ ] **Step 1: Choose V1 provider contract**

Use a provider-neutral static hosting adapter with user-configured command/webhook. No hardcoded credentials.

- [ ] **Step 2: Write failing publish tests**

Tests must package HTML, call configured provider adapter, return public URL, and reject missing credentials without leaking secrets.

- [ ] **Step 3: Implement adapter and UI**

Support local dry-run and provider command mode. Store only safe status in UI.

- [ ] **Step 4: Verify public URL when credentials exist**

If no provider credentials are approved, document A13 as blocked by provider decision, not complete.

- [ ] **Step 5: Commit**

```bash
git add bridge/publish src/features/publish src/server/routes/publish.ts tests/integration/publish.test.ts
git commit -m "feat: add static publish adapter"
```

## Task 11: Desktop Acceptance Automation

**Files:**
- Create: `tests/e2e/desktop/prd-flow.spec.ts`
- Create: `scripts/run-prd-acceptance.mjs`
- Modify: `docs/TEST_REPORT.md`
- Test: opened desktop app

- [ ] **Step 1: Build and open the app**

Run:

```bash
npm run tauri:build
open src-tauri/target/release/bundle/macos/HTML\\ Native\\ Notes.app
```

- [ ] **Step 2: Run the PRD 3-minute flow**

The script must generate an HTML file in the current AI/project directory, register it through MCP/HTTP/CLI fallback, wait under 10 seconds, open it in Vault, create external edit, show diff, perform Markdown-style edit, export package, and save screenshots/evidence.

- [ ] **Step 3: Run all acceptance fixtures**

Run:

```bash
node scripts/run-prd-acceptance.mjs
```

Expected: evidence under `test-results/desktop-launch`, `fixture-imports`, `bridge`, `source-guard`, `versions`, `services`, `editor`, `assets`, and `publish`.

- [ ] **Step 4: Commit evidence docs**

```bash
git add docs/TEST_REPORT.md docs/PRD_REQUIREMENTS_MATRIX.md scripts/run-prd-acceptance.mjs tests/e2e/desktop
git commit -m "test: add desktop prd acceptance run"
```

## Task 12: Release, GitHub, and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY_REVIEW.md`
- Modify: `docs/TEST_REPORT.md`

- [ ] **Step 1: Final secret scan**

Run:

```bash
rg -n "sk-[A-Za-z0-9]|api key|apikey|DeepSeek|deepseek" -S --glob '!node_modules/**' --glob '!dist/**' --glob '!data/**' --glob '!test-results/**' .
```

Expected: no real key in tracked files.

- [ ] **Step 2: Full verification**

Run:

```bash
npm run verify
cd src-tauri && cargo test
npm run tauri:build
node scripts/run-prd-acceptance.mjs
```

- [ ] **Step 3: GitHub repository**

Only after the app is actually complete and verified, create the independent open-source GitHub repository and push it.

- [ ] **Step 4: Final completion audit**

Review every F and A row in `docs/PRD_REQUIREMENTS_MATRIX.md`. Mark complete only when each row has direct evidence. Do not redefine completion around partial tests.

## Self-Review

- Spec coverage: The plan maps every PRD core module and A1-A17 acceptance indicator to implementation and verification tasks.
- Known gap: Rust is not installed; desktop build/open work cannot be verified until installation is approved.
- Placeholder scan: No task is allowed to close with "TBD"; unresolved provider/Rust decisions are explicit gates.
- Type consistency: Renderer bridge methods must mirror shared API response types and Rust command response types before wiring.
