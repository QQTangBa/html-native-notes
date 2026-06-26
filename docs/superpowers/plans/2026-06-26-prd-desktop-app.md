# PRD Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PRD-defined macOS desktop AI HTML Vault app, with Tauri as the default architecture, full Source Guard, Agent Bridge, versioning, Markdown editing, service management, export/publish, and acceptance-test evidence.

**Architecture:** The app is a Tauri desktop shell with a Rust core for filesystem/process/version/security operations and a React/TypeScript UI for the Obsidian-like workbench. Agent access is handled by bounded MCP, HTTP, CLI, inbox, and watcher modules. Every PRD acceptance item is mapped to an automated or manual desktop verification artifact.

**Tech Stack:** Tauri v2, Rust, React, TypeScript, Vite, Tiptap/ProseMirror, MCP TypeScript SDK, Vitest, Rust tests, Playwright/Tauri desktop smoke tests.

---

## File Map

- Create `src-tauri/`: Tauri desktop configuration, capabilities, Rust commands, and Rust core modules.
- Modify `package.json`: replace web-only scripts with desktop, bridge, fixture, and verification scripts while keeping existing unit tests runnable.
- Modify `src/`: keep usable React pieces but reorganize into PRD modules under `features/`.
- Create `bridge/`: MCP server, HTTP bridge, CLI, and shared protocol definitions.
- Create `tests/fixtures/`: mixed 100-file fixture set, 30 Markdown migration fixture set, services, dangerous assets, and external-edit scenarios.
- Create `docs/PRD_REQUIREMENTS_MATRIX.md`: completion ledger for feature and acceptance evidence.
- Modify `README.md`: desktop installation, development, configuration, BYOK AI, test, security, and GitHub usage.
- Modify `docs/TEST_REPORT.md`: final self-test evidence with command output and screenshots.
- Modify `docs/SECURITY_REVIEW.md`: Source Guard, secret handling, process execution, and publishing risk review.

## Environment Gate

- [ ] **Step 1: Verify local desktop prerequisites**

Run:

```bash
which node
node --version
which npm
npm --version
which rustc || true
which cargo || true
```

Expected current result: Node/npm exist; `rustc` and `cargo` are missing.

- [ ] **Step 2: Obtain user decision**

Ask for one decision before implementation:

```text
Tauri is the PRD-recommended path, but this Mac lacks rustc/cargo.
May I install the Rust toolchain for this user account, or should I switch to the Electron fallback?
```

Expected: Do not install global/user toolchains without explicit user confirmation.

- [ ] **Step 3: Record decision**

Update:

```text
docs/TECHNICAL_DESIGN.md
docs/TEST_REPORT.md
```

Expected: the chosen desktop stack and reason are recorded.

## Task 1: Tauri Desktop Shell

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Modify: `package.json`
- Test: `tests/e2e/desktop-launch.spec.ts`

- [ ] **Step 1: Add a failing desktop launch test**

Create `tests/e2e/desktop-launch.spec.ts` with a smoke test that expects a desktop build artifact or dev window to expose the app title `HTML Native Notes`.

Run:

```bash
npm run test:desktop:smoke
```

Expected: FAIL because Tauri shell does not exist.

- [ ] **Step 2: Scaffold Tauri**

Create the Tauri files with one command handler:

```rust
#[tauri::command]
fn app_health() -> &'static str {
    "ok"
}
```

Expected: `npm run tauri dev` opens a desktop window after Rust toolchain is available.

- [ ] **Step 3: Verify**

Run:

```bash
npm run typecheck
npm run test:desktop:smoke
```

Expected: typecheck passes and the desktop smoke test sees the app shell.

- [ ] **Step 4: Commit**

```bash
git add package.json src-tauri tests/e2e/desktop-launch.spec.ts
git commit -m "feat: add tauri desktop shell"
```

## Task 2: Vault Core And Source Guard

**Files:**
- Create: `src-tauri/src/core/vault.rs`
- Create: `src-tauri/src/core/source_guard.rs`
- Create: `src-tauri/src/core/errors.rs`
- Create: `src-tauri/src/commands/vault.rs`
- Create: `src-tauri/src/commands/source_guard.rs`
- Create: `tests/fixtures/source-guard/original.html`
- Test: Rust unit tests in the same modules

- [ ] **Step 1: Write failing Rust tests**

Tests must assert:

- `hash_file` returns the same hash before and after intake.
- `canonicalize_user_path` rejects path traversal outside the selected source.
- `prepare_intake` writes only `.htmlvault` metadata and never modifies original HTML.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_guard
```

Expected: FAIL because modules do not exist.

- [ ] **Step 2: Implement minimal core**

Implement:

- `VaultRoot`
- `VaultManifest`
- `SourceHash`
- `prepare_intake`
- `assert_unchanged`

Expected behavior: no source writes during scan/intake.

- [ ] **Step 3: Verify**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml source_guard vault
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/core src-tauri/src/commands tests/fixtures/source-guard
git commit -m "feat: add vault core and source guard"
```

## Task 3: Import Scanner And Fixture Scale

**Files:**
- Create: `src-tauri/src/core/scanner.rs`
- Create: `src-tauri/src/commands/import.rs`
- Create: `tests/fixtures/mixed-100/`
- Create: `tests/fixtures/markdown-30/`
- Modify: `docs/PRD_REQUIREMENTS_MATRIX.md`

- [ ] **Step 1: Generate deterministic fixtures**

Create fixture generator scripts under `tests/fixtures/scripts/` that produce:

- 60 HTML files
- 40 Markdown files
- 30 Markdown migration files with frontmatter, images, wikilinks, folders, and code blocks

Run:

```bash
npm run fixtures:generate
```

Expected: fixture directories exist and are reproducible.

- [ ] **Step 2: Write failing import tests**

Tests must assert:

- at least 95 of 100 mixed files are recognized, searchable, and previewable
- 30 Markdown files preserve frontmatter, images, wikilinks, folder paths, and code blocks
- three templates are available
- original hashes are unchanged

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml import_scanner
```

Expected: FAIL before scanner implementation.

- [ ] **Step 3: Implement scanner**

Implement read-only detection for:

- `.html`
- `.htm`
- `.md`
- `package.json`
- image/css/js assets
- likely service projects

- [ ] **Step 4: Verify and update matrix**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml import_scanner
```

Expected: PASS. Update A1/A8/A14 evidence fields only after the desktop UI flow also passes.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/core/scanner.rs src-tauri/src/commands/import.rs tests/fixtures docs/PRD_REQUIREMENTS_MATRIX.md
git commit -m "feat: add read-only import scanner"
```

## Task 4: Version Engine

**Files:**
- Create: `src-tauri/src/core/profile.rs`
- Create: `src-tauri/src/core/version_store.rs`
- Create: `src-tauri/src/commands/version.rs`
- Create: `src/features/versions/`
- Create: `src/features/diff/`

- [ ] **Step 1: Write failing tests**

Tests must assert:

- baseline snapshot created on intake
- external source edit creates a new snapshot
- source diff is generated
- content diff is generated
- DOM summary identifies structural changes
- rollback restores the managed Vault copy

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml version_store
npm run test -- tests/unit/diff
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement profile and snapshots**

Implement `.ainote.html` profile metadata and `.htmlvault/versions/` snapshot records.

- [ ] **Step 3: Implement diff UI**

Add source diff, content diff, DOM summary, and screenshot-hint sections.

- [ ] **Step 4: Verify**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml version_store
npm run test -- tests/unit/diff
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/core/profile.rs src-tauri/src/core/version_store.rs src-tauri/src/commands/version.rs src/features/versions src/features/diff
git commit -m "feat: add version engine and diff review"
```

## Task 5: Agent Bridge

**Files:**
- Create: `bridge/shared/protocol.ts`
- Create: `bridge/mcp/server.ts`
- Create: `bridge/mcp/tools.ts`
- Create: `bridge/mcp/resources.ts`
- Create: `bridge/http/server.ts`
- Create: `bridge/http/routes.ts`
- Create: `bridge/cli/index.ts`
- Create: `src/features/agent-bridge/`
- Create: `tests/integration/bridge/`

- [ ] **Step 1: Write failing bridge contract tests**

Tests must cover:

- MCP `registerHtmlAsset`
- MCP `registerWebService`
- HTTP `POST /api/agent/register-html`
- CLI `htmlvault register`
- offline inbox JSONL intake
- file watcher registration

Run:

```bash
npm run test:bridge
```

Expected: FAIL before bridge implementation.

- [ ] **Step 2: Implement shared protocol validation**

Use a single schema for MCP, HTTP, CLI, and inbox requests.

- [ ] **Step 3: Implement transports**

Implement MCP tools/resources, HTTP endpoints, CLI commands, inbox reader, and watcher registration path.

- [ ] **Step 4: Verify 10-second acceptance**

Run:

```bash
npm run test:bridge
```

Expected: PASS and registration completes under 10 seconds in tests.

- [ ] **Step 5: Commit**

```bash
git add bridge src/features/agent-bridge tests/integration/bridge
git commit -m "feat: add agent bridge transports"
```

## Task 6: Markdown Editor, Backlinks, And Preview Edit

**Files:**
- Create: `src/features/editor/`
- Create: `src/features/preview/`
- Create: `src/shared/shortcuts/`
- Create: `tests/unit/editor/`
- Create: `tests/e2e/editor-preview.spec.ts`

- [ ] **Step 1: Write failing editor tests**

Tests must assert:

- Markdown heading/list/task/code/table shortcuts
- slash command opens command menu
- `[[Page]]` creates a link relation
- backlink index updates
- quick open finds linked pages
- preview edit creates a diff and does not inject permanent helper code

Run:

```bash
npm run test -- tests/unit/editor
npm run test:e2e -- tests/e2e/editor-preview.spec.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement Markdown-first editor**

Use Tiptap/ProseMirror and persist edited content as managed HTML.

- [ ] **Step 3: Implement preview edit overlay**

Allow direct text-node editing, then route to diff gate.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/editor
npm run test:e2e -- tests/e2e/editor-preview.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor src/features/preview src/shared/shortcuts tests/unit/editor tests/e2e/editor-preview.spec.ts
git commit -m "feat: add markdown editor and preview editing"
```

## Task 7: Services, Assets, Export, Publish

**Files:**
- Create: `src-tauri/src/core/service_registry.rs`
- Create: `src-tauri/src/core/runtime_manager.rs`
- Create: `src-tauri/src/core/asset_scan.rs`
- Create: `src-tauri/src/core/exporter.rs`
- Create: `src-tauri/src/core/publish.rs`
- Create: `src/features/services/`
- Create: `src/features/assets/`
- Create: `src/features/publish/`

- [ ] **Step 1: Write failing tests**

Tests must assert:

- fixture service starts, health-checks, stops, and restarts
- failed service exposes cwd, command, and log
- missing image is reported
- external script is reported
- unpublishable resource is reported
- single-file, folder package, Markdown, and PDF export paths are produced

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml services assets exporter
npm run test:e2e -- tests/e2e/services-assets-publish.spec.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement service runtime**

Implement app-started process tracking and stop only tracked process IDs unless explicit stop command is configured.

- [ ] **Step 3: Implement asset scanner and exporter**

Implement integrity report and safe package plan.

- [ ] **Step 4: Implement publish adapter boundary**

V1 must support local static package generation and a provider hook with user-configured credentials. No credentials are hardcoded.

- [ ] **Step 5: Verify**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml services assets exporter
npm run test:e2e -- tests/e2e/services-assets-publish.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/core/service_registry.rs src-tauri/src/core/runtime_manager.rs src-tauri/src/core/asset_scan.rs src-tauri/src/core/exporter.rs src-tauri/src/core/publish.rs src/features/services src/features/assets src/features/publish
git commit -m "feat: add services assets export and publish"
```

## Task 8: AI BYOK, Diary, Product Design Polish

**Files:**
- Create: `src/features/diary/`
- Modify: `src/features/settings/`
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: `docs/SECURITY_REVIEW.md`

- [ ] **Step 1: Write failing tests**

Tests must assert:

- safe AI config status does not expose key
- diary original text is preserved
- two organization styles are generated
- mocked 300-1000 word diary completes within 30 seconds
- missing API key produces useful UI state

Run:

```bash
npm run test -- tests/unit/ai tests/unit/diary
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement AI adapter and diary flow**

Use OpenAI-compatible provider config from ignored local/user config.

- [ ] **Step 3: Product Design UI review**

Check:

- Obsidian-like density without cloning brand assets
- all panels responsive to desktop window sizes
- no text overlap
- all icon buttons have tooltips
- command palette and dialogs have keyboard states
- import/diff/service/asset error states are visually clear

- [ ] **Step 4: Verify**

Run:

```bash
npm run test -- tests/unit/ai tests/unit/diary
npm run test:e2e -- tests/e2e/core-workflow.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/diary src/features/settings src/styles.css README.md docs/SECURITY_REVIEW.md
git commit -m "feat: add ai diary flow and product polish"
```

## Task 9: Full Acceptance And GitHub Delivery

**Files:**
- Modify: `docs/PRD_REQUIREMENTS_MATRIX.md`
- Modify: `docs/TEST_REPORT.md`
- Modify: `docs/SECURITY_REVIEW.md`
- Modify: `README.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run verify
npm run test:bridge
npm run test:fixtures:mixed100
npm run test:fixtures:markdown30
npm run test:desktop:smoke
npm audit --audit-level=moderate
```

Expected: all pass or documented with an explicit approved scope decision.

- [ ] **Step 2: Run manual desktop flow**

Open the macOS app and complete A1-A17 from `docs/PRD_REQUIREMENTS_MATRIX.md`.

Expected: screenshots and logs are saved under `test-results/`.

- [ ] **Step 3: Update docs**

Update README, test report, security review, and requirement matrix with actual evidence.

- [ ] **Step 4: Commit**

```bash
git add README.md docs test-results
git commit -m "docs: add final desktop verification evidence"
```

- [ ] **Step 5: Push GitHub**

Run:

```bash
git push origin main
```

Expected: GitHub repository contains source, docs, and verification evidence.

## Self-Review Checklist

- [ ] Every PRD feature F1-F15 has an implementation owner.
- [ ] Every acceptance indicator A1-A17 has a verification flow.
- [ ] Source Guard has before/after hash evidence.
- [ ] Desktop launch evidence exists.
- [ ] No API key or secret is committed.
- [ ] README matches the desktop app, not the old web prototype.
- [ ] Completion is not claimed before the matrix is verified.
