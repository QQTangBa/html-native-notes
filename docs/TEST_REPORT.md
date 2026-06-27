# Test Report

Date: 2026-06-27

## Status Correction

This report describes the earlier local web prototype only. It is not evidence that the PRD-defined macOS desktop app is complete.

Desktop PRD evidence must be collected against `docs/PRD_REQUIREMENTS_MATRIX.md` after the Tauri/Electron environment decision and desktop implementation.

## Desktop Reset Evidence

Date: 2026-06-26

The repository now contains a minimal Tauri desktop scaffold:

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs`
- `src-tauri/capabilities/default.json`
- `tests/unit/desktopScaffold.test.ts`

Validated commands that do not require Rust:

```bash
npm run test -- tests/unit/desktopScaffold.test.ts
```

Result: PASS. 4 tests. This proves the desktop scaffold contract exists; it does not prove the desktop app builds or launches.

Desktop bridge boundary evidence:

```bash
npm run test -- tests/unit/desktopBridge.test.ts tests/unit/App.test.tsx
```

Result: PASS. 2 files, 20 tests. This proves the renderer has a `desktopBridge` boundary that maps Vault, preview, version, service, asset, export, Source Guard, note, AI, and diary operations to explicit Tauri command names when `globalThis.__TAURI__.core.invoke` is available. It also proves the bridge falls back to the HTTP API in web/dev mode and when the current transitional Tauri shell reports a missing command, and that `App` loads Vault items through this bridge instead of importing `apiClient` directly. It does not prove the Rust commands exist yet.

Native desktop inbox command source evidence:

Date: 2026-06-27

```bash
npm run test:desktop:contract
```

Result: PASS. 2 files, 6 tests. This proves the desktop contract test suite covers both the Tauri macOS scaffold and the native inbox command source. `src-tauri/src/core/inbox.rs` contains Rust functions for reading inbox JSONL files, acking processed requests, and intaking a request into the Vault manifest with source hash checks. `src-tauri/src/commands/inbox.rs` exposes `inbox_list_requests`, `inbox_confirm_request`, and `inbox_dismiss_request`, and `src-tauri/src/main.rs` registers those commands. This is source-contract evidence only; Rust/Cargo is not installed, so there is still no native compile, `.app` build, or opened desktop run evidence.

Native desktop Vault read-only command source evidence:

Date: 2026-06-27

```bash
npm run test:desktop:contract
```

Result: PASS. 3 files, 8 tests. This proves the desktop contract suite now also covers `src-tauri/src/core/vault.rs` and `src-tauri/src/commands/vault.rs`. The Rust source declares native `vault_list_library` and `vault_get_asset_source` command boundaries, a manifest reader, library item mapping with relative source paths and thumbnail status, and source reading with current hash / `source_hash_matches` reporting. This is still source-contract evidence only; Cargo build and a launched desktop Vault flow remain pending.

```bash
npm run verify
```

Result: PASS on 2026-06-27 after the desktop bridge, fixture-scale import foundation, external edit watcher, MCP bridge foundation, Agent Inbox React UI, App startup inbox wiring, native inbox source-contract, and native Vault read-only source-contract changes. This ran `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Vitest passed 33 test files and 140 tests, then Vite built `dist/index.html`, `dist/assets/index-Df_w2Mi7.css`, and `dist/assets/index-Crg9pgKq.js`.

PRD fixture-scale import foundation:

```bash
npm run test -- tests/integration/fixtures/prdFixtures.test.ts
```

Result: PASS. 3 tests. The equivalent package command `npm run test:fixtures:mixed100` also passes. This proves `scripts/generate-prd-fixtures.mjs` can generate deterministic 100-file mixed fixtures and 30 Markdown migration notes; the Markdown converter preserves source hashes while converting 30 notes with frontmatter, wikilinks, images, and code blocks; and the current TS Vault intake can register 70 importable HTML/project-index fixtures with source hashes preserved. It does not yet prove the desktop import wizard, Rust scanner, or the PRD requirement that 95 of 100 mixed files open/search/preview in the launched macOS app.

```bash
npm run test
```

Result: PASS. 7 files, 25 tests.

```bash
npm run lint
```

Result: PASS.

Agent Bridge shared protocol evidence:

```bash
npm run test -- tests/unit/agentBridgeProtocol.test.ts
```

Result: PASS. 6 tests. This proves the shared request validation contract for HTML asset registration, web service registration, generic inbox requests, tag normalization, dedupe keys, and basic invalid input rejection. It does not yet prove MCP, HTTP, CLI, file watching, or desktop intake behavior.

MCP bridge foundation evidence:

```bash
npm run test -- tests/integration/bridge/mcpServer.test.ts
```

Result: PASS. 4 tests. This proves the MCP bridge foundation exposes the seven PRD V1 tool definitions: `registerHtmlAsset`, `registerWebService`, `searchVault`, `createNote`, `snapshot`, `publish`, and `importExisting`. It also proves local tool calls can register/search HTML assets, create an HTML note, create a version snapshot, export a local static package, register a service, and accept a read-only `importExisting` request without mutating external source files. This does not yet prove official MCP SDK stdio transport, native inbox commands, or desktop startup inbox loading.

Agent Inbox React UI evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/InboxPanel.test.tsx tests/unit/VaultHome.test.tsx
```

Result: PASS. 2 files, 15 tests. This proves the React Agent Inbox review panel renders pending offline inbox requests, duplicate and invalid-line counters, request tags/source metadata, busy disabled states, an empty state, and confirm/dismiss actions. It also proves VaultHome can place that panel in the dense desktop sidebar and forward confirm/dismiss callbacks by request id. This does not yet prove app startup loading from app-support/Vault inbox JSONL files, Rust/Tauri inbox commands, or a launched native desktop prompt.

Agent Inbox API, desktopBridge, and App startup evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/desktopBridge.test.ts tests/integration/api.test.ts tests/unit/App.test.tsx
```

Result: PASS. 3 files, 39 tests. This proves the renderer bridge exposes `inbox_list_requests`, `inbox_confirm_request`, and `inbox_dismiss_request` command boundaries with HTTP fallback; the local API reads Vault `.htmlvault/inbox/requests.jsonl`, isolates invalid lines, reports duplicate dedupe keys, confirms by registering the request into the Vault manifest and acking it, and dismisses by acking it; and the App startup path renders pending inbox requests in VaultHome, then refreshes inbox/library state after confirm or dismiss. This does not yet prove native app-support inbox path merging, Rust/Tauri command implementations, or a launched macOS desktop prompt.

Agent Bridge fallback evidence:

```bash
npm run test:bridge
```

Result: PASS. 16 files, 53 tests. This proves the shared protocol, MCP bridge tool foundation, local HTTP fallback server, scriptable CLI fallback, offline inbox JSONL support, file watcher request generation, external edit watcher snapshot pipeline, minimal bridge-to-Vault manifest intake, a minimal Vault Library data contract, a minimal Version Engine contract, a minimal Service Registry/Runtime Manager contract, a minimal asset integrity scanner, the initial Markdown import contract, the initial Source Guard write-gate contract, and the initial Vault thumbnail generation contract:

- `GET /health`
- `POST /api/agent/register-html`
- `POST /api/agent/register-service`
- MCP `registerHtmlAsset`, `registerWebService`, `searchVault`, `createNote`, `snapshot`, `publish`, and `importExisting` local tool calls
- `htmlvault register` equivalent through `tsx bridge/cli/index.ts register`
- `htmlvault service register` equivalent through `tsx bridge/cli/index.ts service register`
- `htmlvault thumbnail generate` equivalent through `tsx bridge/cli/index.ts thumbnail generate --vault-dir <path>`
- `--offline-inbox <path>` JSONL append for software-not-running fallback
- inbox read with duplicate dedupe-key skipping
- inbox invalid-line isolation
- inbox acknowledge/rewrite of pending requests
- watcher scan of existing HTML files
- watcher event emission for newly created HTML files
- watcher ignoring non-HTML files and duplicate content events
- HTTP registration can write `.htmlvault/manifest.json` when a Vault path is configured
- bridge intake verifies source hash before registering
- bridge intake preserves the original source file hash
- repeat bridge intake deduplicates by dedupe key
- bridge intake creates a baseline version snapshot
- Vault Library indexes bridge-intaken HTML assets for card/list metadata
- Vault Library enriches title, tags, summary, source agent, source path, folder, and thumbnail status
- Vault Library supports query, tag, source-agent, kind, and folder filters
- version store creates and lists snapshots
- version store returns source diff, readable content diff, and DOM summary
- version store can roll back a managed HTML copy to a prior snapshot
- service registry persists cwd, start command, URL, port, health check, stop command, env hints, and log path
- runtime manager starts an app-managed fixture service
- runtime manager verifies health, stops the service, and restarts it
- runtime manager returns cwd, command, and log path when startup fails
- asset scanner reports missing local images
- asset scanner reports external scripts, stylesheets, and links
- asset scanner reports dangerous inline scripts
- asset scanner reports unpublishable `file://` resources
- asset scanner preserves original HTML source hash during scan
- Markdown import lists three templates
- Markdown import scans folders while preserving relative paths
- Markdown import converts frontmatter, images, wikilinks, and code blocks into readable HTML
- Source Guard write gate reviews readable diffs without changing source files
- Source Guard write gate supports cancel, save-as, and hash-checked write-back
- Source Guard write gate rejects stale write-back when the source changed after review
- Vault thumbnail generator renders missing HTML thumbnails to `.htmlvault/thumbnails/<asset-id>.png`
- Vault thumbnail generator leaves the original HTML source hash unchanged
- Vault thumbnail generator is reachable through the CLI fallback
- Vault Library reports thumbnail status as ready after thumbnail generation
- stable validation errors for invalid registrations

This still does not prove MCP, desktop Vault UI insertion, desktop thumbnail queue wiring, asset localization/package UI, visual diff, full external-edit workflow, native Rust process boundary, or 10-second desktop acceptance.

Service runtime App API and UI evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/api.test.ts tests/unit/VaultHome.test.tsx tests/unit/App.test.tsx
```

Result: PASS. 34 focused tests. The added service tests prove a registry service can be mapped from a Vault service asset by cwd, checked through `GET /api/services/:assetId/health`, started through `POST /api/services/:assetId/start`, stopped through `POST /api/services/:assetId/stop`, and rendered on Vault service cards with status, cwd, health/start/stop controls, and App state updates. This is still local App API/web-renderer evidence; native Tauri process-boundary hardening and desktop launch verification remain pending.

Asset Integrity App API and UI evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/api.test.ts tests/unit/VaultHome.test.tsx tests/unit/App.test.tsx
```

Result: PASS. 37 focused tests. The added asset tests prove `GET /api/assets/:assetId/integrity` scans a registered Vault HTML note without modifying source content, reports missing local images, external resources, dangerous inline scripts, unpublishable `file://` resources, and `safeModeRequired`, and renders a compact risk summary plus scan action on Vault HTML note cards. This does not yet prove asset localization, repair/package flow, or native desktop asset-panel verification.

Diary Organization App API and UI evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/diaryOrganizer.test.ts tests/integration/api.test.ts tests/unit/App.test.tsx
```

Result: PASS. 31 focused tests. The added diary tests prove the BYOK AI adapter prompts for timeline and themes organization styles, parses JSON output, preserves the caller-supplied original text instead of trusting model echo, exposes `POST /api/diary/organize`, avoids returning AI secrets, renders the Diary panel in the main App, shows `原文已保留`, and inserts a selected organization style without replacing the original editor source. This does not yet prove live provider timing, 300-1000 word diary acceptance, persistent diary-note save flow, or native desktop verification.

Local Export App API and UI evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/exporter.test.ts tests/integration/api.test.ts tests/unit/VaultHome.test.tsx tests/unit/App.test.tsx
```

Result: PASS. 44 focused tests. The added export tests prove a registered Vault HTML asset can be exported to `.htmlvault/exports/<assetId>/latest/index.html`, local relative image/stylesheet assets are copied into the package, external resources are recorded as skipped, `manifest.json` is written, source hash remains unchanged, a readable Markdown copy can be generated, `POST /api/export/:assetId/package` and `POST /api/export/:assetId/markdown` return export metadata, and Vault HTML note cards render package/Markdown export actions plus the latest output path. This does not yet prove PDF export, zipped package inspection, provider upload, public link generation, native save dialogs, or native desktop verification.

Static Publish Adapter evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/publish.test.ts tests/integration/api.test.ts tests/unit/config.test.ts tests/unit/desktopBridge.test.ts
```

Result: PASS. The added publish tests prove a registered Vault HTML asset can be packaged and passed to a configured command provider, provider stdout can return a validated HTTP(S) `publicUrl`, disabled providers fail before publish, provider command failures do not leak configured secret values, publish provider configuration is loaded from local env variables, `POST /api/publish/:assetId/static` returns publish metadata, and the renderer bridge maps to `publish_static` with HTTP fallback. This does not yet prove a real cloud/static-hosting upload, outside-network reachability, native Tauri publish commands, or publish UI.

BYOK Settings Visibility evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/config.test.ts tests/integration/api.test.ts tests/unit/SettingsPanel.test.tsx
```

Result: PASS. 21 focused tests. The added settings tests prove safe AI status includes base URL, model, temperature, max tokens, and key-present flag while excluding the API key value; the local API returns the expanded safe status; and the SettingsPanel renders provider details without exposing secrets. This does not yet prove in-app persistence, native secure storage, or live provider smoke from the Settings UI.

Markdown import contract evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/markdownImport.test.ts
```

Result: PASS. 3 tests. This proves the initial Markdown import contract can list three templates, recursively scan Markdown folders while preserving relative paths, and convert a Markdown file into readable HTML while preserving frontmatter, images, wikilinks, and fenced code block language classes. It does not yet prove the desktop import wizard, 30-file fixture acceptance, Obsidian-scale compatibility, or Rust/native import pipeline.

HTML Profile contract evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/htmlProfile.test.ts
```

Result: PASS. 3 tests. This proves the initial HTML Profile contract can extract metadata, assets, AI context, theme variables, and block IDs from HTML; embed and extract profile JSON without rewriting body content; and migrate legacy profile metadata into the current schema. It does not yet prove Rust profile parsing, sidecar manifest synchronization, or full `.ainote.html` migration fixtures.

Markdown note graph metadata evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/noteStore.test.ts tests/unit/NoteLibrary.test.tsx
```

Result: PASS. 8 tests. The added Markdown graph tests prove saved HTML notes are hydrated with `data-wikilink` targets, `data-tag` and visible `#tag` values, computed backlinks by matching wikilinks to note title/slug, and compact NoteLibrary chips for tags, wikilinks, and backlinks. This is still a metadata/display foundation, not the full Markdown-first editor, slash command, or quick-open workflow.

Source Guard write-gate contract evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/sourceGuardWriteGate.test.ts
```

Result: PASS. 5 tests. This proves the initial write-gate contract can produce readable diffs without changing source files, cancel without writing, save edited HTML as a new file while preserving the source hash, write back only after source-hash verification, and reject stale write-back after external source changes. It does not yet prove the Rust Source Guard boundary, native desktop flow, or page-in-place text-node editing.

Vault Library contract evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/vaultLibrary.test.ts
```

Result: PASS. 2 tests. This proves an AI-generated HTML file can be registered into the Vault manifest and then surfaced as a searchable/filterable Vault Library item with title, tags, summary, source agent, relative source path, folder summary, and thumbnail pending path. It does not yet prove the React Vault home UI, true screenshot thumbnail generation, 100 mixed fixture import, preview/open flow, or native Rust Vault core.

Vault thumbnail generation evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/thumbnailGenerator.test.ts
```

Result: PASS. 1 test. This proves the initial thumbnail worker can render a registered HTML note through Playwright Chromium, write a real PNG under `.htmlvault/thumbnails/<asset-id>.png`, preserve the original source hash, and make Vault Library report the thumbnail as ready. It does not yet prove native Rust/Tauri worker wiring, background queue behavior, desktop refresh, or 100-fixture thumbnail coverage.

CLI thumbnail boundary evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/bridge/cliBridge.test.ts
```

Result: PASS. 5 tests. The added CLI test proves `thumbnail generate --vault-dir <path>` can be called by an external agent/script, generate a real PNG thumbnail for a registered HTML asset, and return generated/skipped counts plus generated paths.

VaultHome React component evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/VaultHome.test.tsx
```

Result: PASS. 7 tests. This proves the first React Vault home component renders an Obsidian-inspired dense desktop workspace with sidebar folders, search, card/list view toggle, tag/source/folder filters, card metadata, thumbnail ready/pending states, a compact toolbar action for generating pending thumbnails, a read-only HTML preview pane, and a Source Guard review panel for edited preview HTML drafts with cancel/save-as/write-back actions. It also proves switching preview items exits edit mode instead of carrying a stale draft forward. It does not yet prove Tauri wiring, true native desktop launch, keyboard command palette, native Vault data loading, or rendered-page text-node editing.

Vault Library API evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/api.test.ts
```

Result: PASS. 11 tests. The Vault tests prove `/api/vault/library` can read the configured local Vault directory, return AI-generated HTML already registered through bridge intake, and honor query/tag/source-agent filters. They also prove `POST /api/vault/thumbnails/generate` can generate missing thumbnails for the configured Vault and make the library return a ready thumbnail path, `GET /api/vault/assets/:assetId/source` can read registered HTML source for read-only preview with current/source hash evidence, `POST /api/vault/assets/:assetId/write-review` can produce a Source Guard diff without mutating the source, and `POST /api/vault/write-decision` can cancel, save-as, and hash-checked write-back from a server-recomputed review. Additional Source Guard API coverage rejects symlink escapes outside the Vault, refuses save-as collisions, and proves fabricated client reviews cannot redirect a write to another in-Vault file. They do not yet prove Tauri command wiring or user-selected Vault persistence.

App Vault loading evidence:

Date: 2026-06-27

```bash
npm run test -- tests/unit/App.test.tsx
```

Result: PASS. 8 tests. The App tests prove the renderer calls the Vault Library API, shows VaultHome with an agent-generated HTML asset when the configured Vault has items, calls `POST /api/vault/thumbnails/generate` from the desktop toolbar, refreshes the library after thumbnails become ready, opens a selected registered HTML file in the read-only preview pane, posts edited preview HTML to the Source Guard write-review API, renders the diff panel, submits an explicit cancel decision with `assetId + editedHtml`, and ignores a late review response after the user opens a different preview asset. They do not yet prove native Tauri launch or real user-selected Vault loading.

Vault Source Guard preview edit evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/api.test.ts tests/unit/VaultHome.test.tsx tests/unit/App.test.tsx
```

Result: PASS. 26 tests. This proves the current preview-source edit flow from three angles: the local API creates a review without changing source files, applies cancel/save-as/write-back decisions from server-recomputed review data, rejects symlink escapes, rejects save-as overwrite, and ignores fabricated review redirection; the VaultHome component exposes an editable HTML draft, a Source Guard diff region, explicit decision buttons, and stale-draft reset on preview switch; the App shell calls the review API, submits the cancel decision, and drops late reviews from previously active assets. This is not yet direct text editing inside the rendered iframe.

Vault Version Engine API and UI evidence:

Date: 2026-06-27

```bash
npm run test -- tests/integration/api.test.ts tests/unit/VaultHome.test.tsx tests/unit/App.test.tsx
```

Result: PASS. 35 focused tests after review fixes. The added version tests prove the local API can list baseline snapshots, create an explicit `external-agent-edit` snapshot, diff two snapshots with source/content/DOM summaries, and roll back a registered Vault source to a selected snapshot. They also prove the VaultHome preview pane renders a compact Version timeline, Compare latest versions action, rollback buttons, and source/content/DOM diff regions; the App shell loads versions after preview open, calls the latest-version diff endpoint, posts rollback decisions, and refreshes preview source after rollback. Review follow-up tests prove unsafe encoded asset IDs are rejected, tampered snapshot `contentPath` values outside `.htmlvault/versions/<assetId>/` are rejected before reads, renderer-facing snapshots do not expose `contentPath`, and late version diff responses are ignored after the user starts opening another preview asset.

Additional external edit scan evidence:

```bash
npm run test -- tests/integration/bridge/versionStore.test.ts
```

Result: PASS. 5 tests. The added test proves `snapshotExternalVaultEdits` can detect a registered HTML source hash change, create exactly one `external-agent-edit` snapshot, and skip duplicate snapshots when the same changed content is scanned again.

```bash
npm run test -- tests/integration/bridge/fileWatcher.test.ts tests/integration/bridge/externalEditVersion.test.ts tests/integration/bridge/versionStore.test.ts
```

Result: PASS. 3 files, 9 tests. This proves `createExternalEditVersionWatcher` debounces filesystem events and polling into the external-edit snapshot pipeline, so a registered HTML file changed outside the app gets a new `external-agent-edit` snapshot. This still does not prove native Rust watcher wiring, branch/recover, screenshot hints, or native Tauri desktop launch.

```bash
npm run test:bridge
```

Result: PASS. 15 files, 49 tests.

Runtime VaultHome browser evidence:

Date: 2026-06-27

Commands:

```bash
npx tsx --eval "<generate data/vault/imports/ai/codex-generated-market.html and intake into data/vault/.htmlvault/manifest.json>"
npm run dev
curl -s "http://127.0.0.1:5178/api/vault/library?q=codex"
node --input-type=module "<open http://127.0.0.1:5178 with Playwright and screenshot>"
```

Result: PASS. A runtime AI-generated HTML file at `data/vault/imports/ai/codex-generated-market.html` appears in the Vault Library API and in the rendered VaultHome page. Screenshot saved locally at `test-results/desktop-launch/vault-home-runtime-html.png`. This proves the current web-renderer path can read a generated HTML file from the local Vault and display it; it still does not prove native Tauri `.app` launch because Rust is not installed.

Runtime thumbnail toolbar evidence:

Date: 2026-06-27

Commands:

```bash
npm run dev -- --host 127.0.0.1 --port 5178
node --input-type=module "<open VaultHome with Playwright, screenshot pending state, click Generate, verify ready state, screenshot ready state>"
```

Result: PASS. The local VaultHome page showed the pending thumbnail toolbar action for `data/vault/imports/ai/codex-generated-market.html`; after clicking it, `POST /api/vault/thumbnails/generate` produced `data/vault/.htmlvault/thumbnails/asset_b7281069949f6c6e.png`, the card changed to `Thumbnail ready`, and the toolbar showed `Thumbnails ready`. Screenshots saved locally at `test-results/desktop-launch/vault-thumbnail-action-pending.png` and `test-results/desktop-launch/vault-thumbnail-action-ready.png`. This is still web-renderer evidence, not native Tauri `.app` evidence.

Runtime read-only preview evidence:

Date: 2026-06-27

Commands:

```bash
npm run dev -- --host 127.0.0.1 --port 5178
node --input-type=module "<open VaultHome with Playwright, click Preview, verify iframe srcDoc, screenshot>"
```

Result: PASS. The local VaultHome page opened `data/vault/imports/ai/codex-generated-market.html` through `GET /api/vault/assets/asset_b7281069949f6c6e/source`, rendered it in the right-side read-only iframe, and kept the selected card highlighted. Screenshot saved locally at `test-results/desktop-launch/vault-readonly-preview.png`. This is still web-renderer evidence, not native Tauri `.app` evidence.

Native desktop Source Guard command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeSourceGuard.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeSourceGuard.test.ts` passed 3 tests covering the Rust Source Guard core source, `source_guard_review_write` and `source_guard_apply_write_decision` command registration, readable diff/write decision markers, source hash write-back checks, and canonical Vault boundary checks for source/save-as paths. `npm run test:desktop:contract` passed 4 files and 11 tests, now including the Source Guard native command source contract. This is source/contract evidence only; Cargo build and launched Tauri flow remain pending because Rust is not installed in PATH.

Native desktop Version Engine command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeVersionStore.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeVersionStore.test.ts` passed 3 tests covering Rust Version Engine core source for list/create/diff/rollback, `vault_list_versions`, `vault_create_version_snapshot`, `vault_diff_versions`, and `vault_rollback_version` command registration, safe `asset_*` ID checks, snapshot content realpath boundary checks, source path Vault boundary checks, readable source/content diff markers, DOM summary, and rollback response shape. `npm run test:desktop:contract` passed 5 files and 14 tests, now including the Version Engine native command source contract. This is source/contract evidence only; Cargo build and launched Tauri flow remain pending because Rust is not installed in PATH.

Native desktop asset integrity command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeAssetScan.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeAssetScan.test.ts` passed 3 tests covering Rust asset scanner source for read-only HTML integrity checks, `asset_scan_integrity` command registration, source hash reporting, dangerous inline script collection, Vault boundary checks before scan, and absence of `fs::write` in the scanner core. `npm run test:desktop:contract` passed 6 files and 17 tests, now including the asset scan native command source contract. This is source/contract evidence only; Cargo build and launched Tauri flow remain pending because Rust is not installed in PATH.

Native desktop service runtime command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeServiceRuntime.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeServiceRuntime.test.ts` passed 3 tests covering Rust service runtime source for registry-backed health/start/stop, `service_check_health`, `service_start`, and `service_stop` command registration, service asset to registry mapping, PRD fields for cwd/start/stop/url/health/env/log, `/bin/zsh` command boundary, local TCP health probe, app-managed process tracking, and failure/log-path status evidence. `npm run test:desktop:contract` passed 7 files and 20 tests, now including the service runtime native command source contract. This is source/contract evidence only; Cargo build and launched Tauri flow remain pending because Rust is not installed in PATH.

Native desktop export command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeExporter.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeExporter.test.ts` passed 3 tests covering Rust exporter source for static package and Markdown export, `export_static_package` and `export_markdown` command registration, managed `.htmlvault/exports/<assetId>/latest` output boundary, `manifest.json`, local asset copy helper, skipped external resources, Markdown conversion helper, and source hash reporting. `npm run test:desktop:contract` passed 8 files and 23 tests, now including the exporter native command source contract. This is source/contract evidence only; Cargo build and launched Tauri flow remain pending because Rust is not installed in PATH.

Native desktop publish command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativePublish.test.ts
npm run test:desktop:contract
which cargo
which rustc
```

Result: PASS for source contract, environment still blocked for Cargo. `tests/unit/desktopNativePublish.test.ts` passed 3 tests covering Rust publish core source, `publish_static` command registration, static package handoff through the exporter, user-configured `PUBLISH_PROVIDER_MODE`, `PUBLISH_COMMAND`, `PUBLISH_COMMAND_ARGS`, and `PUBLISH_REQUIRED_ENV`, `HTML_NATIVE_NOTES_*` package env propagation, generic provider command failure text, and no provider output leakage in the source. `npm run test:desktop:contract` passed 10 files and 29 tests, now including the publish native command source contract. `cargo` and `rustc` were not found in PATH, so Cargo build and launched Tauri publish flow remain pending.

Native desktop importer command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeImporter.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeImporter.test.ts` passed 4 tests covering Rust importer source for read-only existing project scans, `import_scan_candidates` command registration, HTML, Markdown, project, and service candidate markers, `package.json` and `index.html` detection, source hash reporting, no `fs::write` or `fs::copy` in the scanner core, and skip rules for `.git`, `.htmlvault`, `node_modules`, `dist`, `build`, and `target`. `npm run test:desktop:contract` passed 11 files and 33 tests, now including the importer native command source contract. This is source/contract evidence only; Cargo build, import confirmation, full 100 old project-dir hash proof, and launched Tauri import flow remain pending because Rust is not installed in PATH.

Native desktop note command source evidence:

Date: 2026-06-27

Commands:

```bash
npm run test -- tests/unit/desktopNativeNotes.test.ts
npm run test:desktop:contract
```

Result: PASS. `tests/unit/desktopNativeNotes.test.ts` passed 3 tests covering Rust note store source for HTML note CRUD, `note_list`, `note_create`, `note_get`, `note_save_content`, `note_duplicate`, and `note_delete` command registration, local `.htmlvault/notes-store` metadata/notes/trash storage, safe note id checks, and wikilink/tag/backlink metadata hooks. `npm run test:desktop:contract` passed 9 files and 26 tests, now including the notes native command source contract. This is source/contract evidence only; Cargo build, Markdown-first rich editor behavior, and launched Tauri flow remain pending because Rust is not installed in PATH.

Latest full non-Rust validation:

```bash
npm run verify
```

Result: PASS on 2026-06-27. This ran `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Vitest passed 39 test files and 158 tests, then Vite built `dist/index.html`, `dist/assets/index-Df_w2Mi7.css`, and `dist/assets/index-Crg9pgKq.js`.

Additional security check:

Result: targeted secret scan with hidden and ignored files included returned one expected real-key hit in ignored `.env.local`; committed files only contain placeholder/example AI key strings or test fake keys.

During validation, running `npm run test` and `npm run test:bridge` concurrently exposed a shared fixed-port conflict in `tests/integration/bridge/serviceRuntime.test.ts`. The test now allocates an available local port per run, and the concurrent validation pair passes.

Current desktop blocker:

```bash
which rustc || true
which cargo || true
```

Result: `rustc not found`, `cargo not found`.

The Tauri app has not been built or opened yet because Rust is not installed in PATH and user confirmation is required before installing the Rust toolchain.

## Historical Web Prototype Summary

The following commands describe the earlier web-prototype validation before the PRD desktop reset. For current evidence, use the non-Rust validation section above.

## Commands Run

```bash
npm run test
```

Result: PASS. 6 files, 21 tests.

```bash
npm run typecheck
```

Result: PASS.

```bash
npm run lint
```

Result: PASS.

```bash
npm run build
```

Result: PASS. Vite production build generated `dist/`.

```bash
npm run test:e2e
```

Result: PASS. 4 Playwright tests across desktop Chromium and mobile Pixel 5.

```bash
npm audit --audit-level=moderate
```

Result: PASS. 0 vulnerabilities.

```bash
node scripts/test-ai-config.mjs
```

Result: PASS. DeepSeek `deepseek-v4-flash` returned `HTML Native Notes AI OK`.

## Important Fixes Found During Testing

- Development Vite middleware initially intercepted `/api/health`; API routes now bypass Vite.
- Vite initially reloaded the page when notes were written under `data/`; `data/`, `test-results/`, and `playwright-report/` are now ignored by Vite watch.
- Parallel E2E sessions exposed a metadata write race; `FileNoteStore` now serializes metadata-changing operations.
- The AI connectivity script initially used too small a token cap for `deepseek-v4-flash`; it now uses configured `AI_MAX_TOKENS`.

## Remaining Notes

- Runtime notes are stored under local `data/`, which is gitignored.
- `.env.local` contains local-only credentials and is gitignored.
