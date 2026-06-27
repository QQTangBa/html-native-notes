# PRD Gap Audit

Date: 2026-06-27
Authoritative PRD: `/Users/siter/Documents/需求池项目/research/ai-html-notes-prd.html`
Project root: `/Users/siter/Documents/HTML原生笔记编辑器/html-native-notes`

## Correction

This project is not complete. The current repository contains a useful TypeScript/Web fallback foundation plus a minimal Tauri scaffold, but the PRD requires a macOS desktop application. Passing Web/API tests is not enough. Completion requires a built and opened macOS app whose desktop boundary, UI flows, source safety, agent bridge, import, edit, version, service, asset, export, and publish workflows are verified against the PRD acceptance indicators.

The current Tauri Rust side is only a shell command:

- `src-tauri/src/main.rs` exposes `app_health`.
- It does not expose Vault, Source Guard, Version Engine, Service Runtime, Agent Inbox, Import, Asset, Export, Publish, or Settings commands.
- The app has not been built or opened because this machine has no `rustc` or `cargo` in PATH.

## Current Honest State

| Area | Current evidence | Honest status |
| --- | --- | --- |
| Dedicated project folder | All project files are under `html-native-notes/`. | Satisfied. |
| Technical documents | `docs/TECHNICAL_DESIGN.md`, matrix, test report, and plans exist. | Started, must be kept current. |
| macOS desktop app | Tauri config and trivial Rust entrypoint exist. | Not product-complete, not built, not opened. |
| Obsidian-like desktop UI | `VaultHome` has a dark dense library UI. | Partial Web renderer only. |
| Vault library | TS manifest, API, search/filter, thumbnails, preview. | Partial; no native command boundary or 100-file acceptance. |
| Agent Bridge | TS protocol, CLI, HTTP fallback, inbox JSONL, watcher helpers. | Partial; no MCP server, no desktop inbox review UI, no skill/plugin package. |
| Service Registry/Runtime | TS registry/runtime and UI card controls. | Partial; native process boundary missing. |
| Source Guard | TS hash/diff/write decision API and UI panel. | Partial; no Rust guard, no page-in-place edit. |
| Version Engine | TS snapshots/diff/rollback and UI timeline. | Partial; no watcher-triggered external edit flow, branch/recover, screenshot hints. |
| Markdown import/editing | One-file importer and metadata extraction. | Partial; no 30-note fixture, no real Markdown-first editor. |
| HTML Profile | TS profile parser/embedder. | Partial; no sidecar/native integration. |
| Diary organizer | BYOK AI endpoint and compact UI. | Partial; no 300-1000 word timed live smoke or four PRD styles. |
| BYOK settings | Safe status display. | Partial; no in-app persistence or native secure storage. |
| Asset management | Integrity scan and local export package. | Partial; no localization/repair UI or PDF/publish. |
| Export/publish | Local static package, Markdown export, and command-provider publish adapter. | Partial; no PDF, zipped package, real provider upload proof, or reachable public-link evidence. |
| Full self-test | `npm run verify` passed for TS/Web scope. | Insufficient; no opened desktop app and no end-to-end PRD acceptance run. |

## PRD Acceptance Audit

| ID | PRD acceptance indicator | Current state | Required completion evidence |
| --- | --- | --- | --- |
| A1 | Import 100 mixed HTML/Markdown files; 95% open/search/preview. | Partial Web fixture only. | Generated 100-file fixture, native import run, count report, screenshots. |
| A2 | MCP/CLI/HTTP/file-watch generated HTML enters Vault within 10 seconds with source, summary, thumbnail. | Partial CLI/HTTP/watch helpers. | MCP server, timed desktop flow, thumbnail evidence, source hash proof. |
| A3 | Offline inbox fallback works and app later prompts registration. | JSONL helper exists, no startup prompt UI. | Desktop startup reads inbox, shows pending requests, confirms import, dedupes. |
| A4 | Registered local dashboard health-checks, starts, and shows cwd/log on failure. | TS runtime/API works. | Native desktop service open flow with failure UI screenshot. |
| A5 | User can stop app-started local service and start it again. | TS runtime/API works. | Native desktop stop/restart evidence. |
| A6 | Intake original HTML preserves content hash. | TS tests exist. | Native import/index/preview/thumbnail/scan/version-init hash proof. |
| A7 | Any original write shows diff first and supports write back/save-as/cancel. | TS Source Guard UI exists. | Native desktop diff gate screenshots and file-hash proof. |
| A8 | Import 100 old web/project dirs without modifying originals. | Partial native scanner source. | Full 100 old project-dir import, before/after hash report, desktop import UI, and launched app evidence. |
| A9 | External agent edits create snapshots; user can diff and roll back. | Manual snapshot/diff/rollback exists. | Watcher-triggered external edit run and rollback proof. |
| A10 | Two HTML versions show source diff, content diff, DOM summary, screenshot hint. | Source/content/DOM partial. | Screenshot hint/visual-change evidence in desktop UI. |
| A11 | 300-1000 word diary generates two styles within 30 seconds and preserves original. | Mocked short-text flow only. | Timed DeepSeek/local provider smoke with long fixture and preserved original. |
| A12 | Preview edit button allows direct text edit, then diff/write/save-as/cancel. | Source textarea edit only. | Runtime page text-node overlay and diff gate. |
| A13 | Local HTML upload generates public link reachable outside local network. | Partial adapter only. | Run with approved real provider credentials and verify reachable public URL outside local network. |
| A14 | Import 30 Markdown notes preserving links/images/frontmatter/folders/code blocks and 3 templates. | One Markdown fixture only. | 30-note fixture, template selection, generated HTML inspection. |
| A15 | User can create/edit HTML notes with Markdown syntax and `[[page]]` backlinks. | Metadata extraction only. | Real Markdown-first editor, shortcuts, quick open, backlink creation. |
| A16 | Asset integrity reports missing images, external scripts, unpublishable resources. | TS scan/API/UI exists. | Native desktop asset panel and repair/localization flow. |
| A17 | In 3 minutes: AI page enters Vault, diff visible, Markdown-style edit happens, export works. | Individual Web/API pieces exist. | Timed opened desktop run with artifacts. |

## Blocking Environment Fact

`rustc` and `cargo` are not installed in PATH. Tauri desktop build/open self-test cannot be completed until Rust is installed or the user explicitly switches to Electron. Installing Rust modifies user-level toolchain directories such as `~/.cargo`, so it needs explicit approval before I do it.

## Development Rule Going Forward

Do not call the project complete until every acceptance indicator above has direct current evidence from the desktop app, command output, source-hash reports, screenshots, or generated artifacts. Web/API tests are useful regression coverage, but they cannot prove the macOS desktop product is complete.
