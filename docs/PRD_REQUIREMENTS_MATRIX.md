# PRD Requirements And Acceptance Matrix

Date: 2026-06-26
PRD: `/Users/siter/Documents/需求池项目/research/ai-html-notes-prd.html`
Project root: `/Users/siter/Documents/HTML原生笔记编辑器/html-native-notes`

This matrix is the completion ledger. Rows cannot be marked complete without direct evidence from code, tests, screenshots, command output, or a launched desktop app run.

## Core Feature Matrix

| ID | PRD requirement | Implementation owner | Required tests | Current status | Evidence |
| --- | --- | --- | --- | --- | --- |
| F1 | Vault home with folder-like library, cards/list, thumbnails, title, tags, updated time, source, search, filters | React `features/vault`, Rust `core/vault` | component tests, desktop flow, 100-fixture search test | Not implemented | Pending |
| F2 | Agent Bridge through MCP, CLI, HTTP API, offline inbox, file watching | `bridge/*`, Rust inbox/watcher commands | MCP integration, HTTP integration, CLI integration, inbox startup, watcher test | Protocol schema, HTTP fallback, CLI fallback, offline inbox, watcher request generation, and minimal manifest intake started; MCP/desktop UI/thumbnail missing | `npm run test:bridge` PASS for shared request schemas, HTTP health, `register-html`, `register-service`, CLI `register`, CLI `service register`, CLI `--offline-inbox`, JSONL read/dedupe/ack, watcher scan/new-file/dedupe, HTTP-to-manifest intake, source hash preservation, and validation errors |
| F3 | Service Registry with cwd/start/url/port/health/stop/env/log | Rust `service_registry`, React `features/services` | schema unit tests, UI tests, fixture service registration | Not implemented | Pending |
| F4 | Runtime Manager health-check, start if down, show state, stop | Rust `runtime_manager`, Tauri commands | fixture service start/stop, failed command log test | Not implemented | Pending |
| F5 | Source Guard read-only intake and diff-gated writes | Rust `source_guard`, React `features/diff` | hash unchanged tests, path traversal tests, write gate UI test | Minimal bridge intake hash guard started; Rust Source Guard and diff-gated writes missing | `npm run test:bridge` PASS for bridge intake hash check and source hash preservation |
| F6 | Version Engine snapshots, external changes, diff, rollback, branch/recover | Rust `version_store`, React `features/versions` | snapshot unit tests, external edit integration, rollback test | Minimal TS version store started; Rust core, UI timeline, branch/recover missing | `npm run test:bridge` PASS for baseline snapshots, source diff, content diff, DOM summary, and rollback of managed copy |
| F7 | Markdown-first editor with shortcuts, slash command, wikilinks, backlinks, tags, quick open | React `features/editor` | editor command tests, backlink index tests, desktop edit flow | Not implemented | Pending |
| F8 | Markdown and existing import preserving frontmatter/images/wikilinks/tags/folders/code blocks/templates | Rust `scanner`, React `features/import` | 30 Markdown fixture test, 100 mixed fixture test, hash unchanged test | Not implemented | Pending |
| F9 | HTML Profile with metadata, block IDs, asset list, AI context, theme vars, version | Rust `profile` | profile parse/write tests, migration tests | Not implemented | Pending |
| F10 | Page-in-place editing from preview with snapshot + diff | React `features/preview`, Rust version/write gate | edit overlay test, diff gate desktop flow | Not implemented | Pending |
| F11 | Diary organization with at least two styles, preserves original | React `features/diary`, AI adapter | mocked AI test, live BYOK smoke test, original preservation test | Not implemented | Pending |
| F12 | Open-source BYOK AI config, no hardcoded secrets | React `features/settings`, config command | config validation test, secret exposure test, live provider smoke | Partially prototyped only | Pending desktop implementation |
| F13 | Asset management for missing images/CSS/JS, dangerous scripts, broken externals, safe mode | Rust `asset_scan`, React `features/assets` | dangerous fixture test, missing asset test, report UI test | Not implemented | Pending |
| F14 | Export single file/folder package/Markdown/PDF and publish/static hosting adapter | Rust `exporter/publish`, React `features/publish` | export tests, package inspection, publish adapter test | Not implemented | Pending |
| F15 | macOS desktop app, Intel + Apple Silicon target, older macOS considered | Tauri `src-tauri` | desktop launch, bundle config check, build report | Scaffold started; not built | `npm run test -- tests/unit/desktopScaffold.test.ts` PASS; Rust toolchain still missing, so no desktop launch evidence yet |

## Acceptance Indicators

| ID | PRD acceptance indicator | Verification command or flow | Status | Evidence |
| --- | --- | --- | --- | --- |
| A1 | Import 100 mixed HTML/Markdown files; 95% open/search/preview | `npm run test:fixtures:mixed100` plus desktop import screenshot | Missing | Pending |
| A2 | MCP/CLI/HTTP/file-watch generated HTML enters Vault within 10 seconds with source, summary, thumbnail | `npm run test:bridge` and desktop bridge flow | Partial | HTTP-to-manifest intake exists; MCP, desktop UI, thumbnail, summary, and 10-second desktop flow still pending |
| A3 | Offline inbox fallback works when MCP/HTTP/CLI unavailable and app later prompts registration | inbox JSONL integration test and desktop startup flow | Missing | Pending |
| A4 | Registered local dashboard health-checks, starts, and shows command/cwd/log on failure | fixture service desktop flow | Missing | Pending |
| A5 | User can stop app-started service and restart it | service lifecycle integration test | Missing | Pending |
| A6 | Intake original HTML preserves content hash | source hash before/after test | Partial | bridge intake test preserves source hash; Rust Source Guard and desktop import evidence still pending |
| A7 | Any write back shows diff and supports write back/save-as/cancel | diff gate component + desktop flow | Missing | Pending |
| A8 | Import 100 old web/project dirs without modifying originals | project fixture hash test | Missing | Pending |
| A9 | External agent edits create snapshots; user can diff and roll back | watcher + version integration test | Partial | version store can snapshot/diff/rollback managed copy; external watcher-to-version UI flow pending |
| A10 | Two HTML versions show source diff, content diff, DOM summary, screenshot hint | version diff UI flow | Partial | source diff, content diff, and DOM summary exist in TS tests; screenshot hint/UI pending |
| A11 | 300-1000 word diary generates two organization styles within 30 seconds and preserves original | mocked AI timing test + BYOK smoke | Missing | Pending |
| A12 | Preview edit button allows direct text edit, then diff/write/save-as/cancel | desktop preview edit flow | Missing | Pending |
| A13 | Local HTML upload generates public link reachable outside local network | publish adapter test with configured target | Missing | Pending provider decision |
| A14 | Import 30 Markdown notes preserving wikilinks/images/frontmatter/folders/code blocks and 3 templates | `npm run test:fixtures:markdown30` | Missing | Pending |
| A15 | User can create/edit HTML notes with Markdown syntax and `[[page]]` backlinks | editor and backlink tests | Missing | Pending |
| A16 | Asset integrity reports missing images, external scripts, unpublishable resources | asset scanner dangerous fixture test | Missing | Pending |
| A17 | 3-minute flow: AI page enters Vault, diff visible, Markdown-style edit, export | end-to-end timed desktop script | Missing | Pending |

## Required Evidence Naming

When implementation starts, evidence should be saved under:

```text
test-results/
  desktop-launch/
  fixture-imports/
  bridge/
  source-guard/
  versions/
  services/
  editor/
  assets/
  publish/
```

Each acceptance row should receive:

- command run
- pass/fail output
- relevant screenshots
- fixture path
- source hash proof when Source Guard is involved
- date/time of run

## Current Gate

The project has moved from pure web prototype to a minimal Tauri scaffold, but cannot build or launch the desktop app on this machine until the Tauri environment decision is made:

- Option 1: user approves Rust toolchain installation for Tauri development.
- Option 2: user explicitly chooses Electron fallback, accepting higher package size and resource cost.

The PRD recommends Tauri, so Option 1 is the default technical recommendation.
