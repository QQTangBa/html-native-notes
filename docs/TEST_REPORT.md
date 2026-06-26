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

```bash
npm run typecheck
```

Result: PASS.

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

Agent Bridge fallback evidence:

```bash
npm run test:bridge
```

Result: PASS. 10 files, 35 tests. This proves the shared protocol, local HTTP fallback server, scriptable CLI fallback, offline inbox JSONL support, file watcher request generation, minimal bridge-to-Vault manifest intake, a minimal Version Engine contract, a minimal Service Registry/Runtime Manager contract, a minimal asset integrity scanner, and the initial Markdown import contract:

- `GET /health`
- `POST /api/agent/register-html`
- `POST /api/agent/register-service`
- `htmlvault register` equivalent through `tsx bridge/cli/index.ts register`
- `htmlvault service register` equivalent through `tsx bridge/cli/index.ts service register`
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
- stable validation errors for invalid registrations

This still does not prove MCP, desktop Vault UI insertion, thumbnail generation, asset localization/package UI, visual diff, full external-edit workflow, native Rust process boundary, or 10-second desktop acceptance.

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

Latest full non-Rust validation:

```bash
npm run typecheck
npm run test
npm run lint
npm run test:bridge
```

Result: PASS. Full test run: 18 files, 63 tests. Bridge test run: 10 files, 35 tests.

During validation, running `npm run test` and `npm run test:bridge` concurrently exposed a shared fixed-port conflict in `tests/integration/bridge/serviceRuntime.test.ts`. The test now allocates an available local port per run, and the concurrent validation pair passes.

Current desktop blocker:

```bash
which rustc || true
which cargo || true
```

Result: `rustc not found`, `cargo not found`.

The Tauri app has not been built or opened yet because Rust is not installed in PATH and user confirmation is required before installing the Rust toolchain.

## Summary

The current local application passed unit tests, integration tests, browser E2E tests, production build, dependency audit, and a live DeepSeek connectivity check.

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
