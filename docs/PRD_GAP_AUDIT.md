# PRD Gap Audit

Date: 2026-06-26
Authoritative PRD: `/Users/siter/Documents/需求池项目/research/ai-html-notes-prd.html`
Current implementation audited: `/Users/siter/Documents/HTML原生笔记编辑器/html-native-notes`

## Correction

The current implementation is not the PRD-complete product. It is a local web app proof slice. The PRD requires a macOS desktop application whose V1 MVP includes a full HTML Vault workflow, agent bridge, source guard, version engine, Markdown migration/editing, page-in-place editing, service management, asset management, and publishing/export paths.

This project must be re-scoped from "local web app" to "macOS desktop app." Completion must not be claimed until the PRD acceptance indicators are verified against the actual desktop app.

## PRD One-Phase Core Features

| ID | PRD feature | Required behavior | Current state | Gap |
| --- | --- | --- | --- | --- |
| F1 | Vault 首页 | Folder-style local library, cards, thumbnails, title, tags, update time, source, search, filters. | Basic note list only. | Missing folder model, thumbnails, source metadata, tags UI, filters, real Vault import. |
| F2 | Agent Bridge | Agent skill/plugin, MCP server, CLI, HTTP API, offline inbox, file watching. | None. | Entire bridge missing. |
| F3 | Service Registry | Register cwd, start command, URL, port, health check, stop command, env hints, log path. | None. | Entire service asset model missing. |
| F4 | Runtime Manager | Detect service health, start if down, show state, stop service. | None. | Rust/native process management required. |
| F5 | Source Guard | Read-only intake; indexing, preview, screenshot, scan, version init must not modify source; write requires explicit diff confirmation. | Partial local note write model; not source-guarded import. | Need hash checks, write policy, diff gate, tests proving original files unchanged. |
| F6 | Version Engine | Git-like snapshots for HTML/web assets, external changes, diff, rollback, branch/recover. | None. | Need version store, snapshot metadata, diff UI, rollback flow. |
| F7 | Markdown-first editor | Markdown syntax, shortcuts, slash commands, wikilinks, backlinks, tags, quick open; saved as HTML. | HTML textarea only. | Need Tiptap/ProseMirror or equivalent, Markdown transform, backlink index. |
| F8 | Markdown and existing import | Read-only scan of Markdown/HTML/project dirs; preserve frontmatter, images, wikilinks, tags, folder structure; choose templates. | None. | Need importer, templates, scanner, no-source-mutation tests. |
| F9 | HTML Profile | Standard metadata, block IDs, asset manifest, AI context, theme vars, version. | Basic metadata JSON only. | Need `.ainote.html` profile schema and migration. |
| F10 | Page-in-place edit mode | Runtime edit layer in preview, text-node editing, exit with snapshot and diff; no permanent injected code. | None. | Need preview edit overlay and write/duplicate/cancel flow. |
| F11 | Diary整理 | Oral text input, style choices, at least two organized outputs, preserve source. | None. | Need AI prompt templates and UI/tests. |
| F12 | AI/BYOK/license | Open-source core with user-provided provider config. | Partial BYOK config and AI action. | Need desktop-safe config storage and PRD-specific AI flows. |
| F13 | Asset management | Localize/check images/CSS/JS, detect dangerous scripts and broken external links, static safe mode. | Preview strips scripts. | Need full asset scan report and optional copy/localization flow. |
| F14 | Sync/publish/export | Export single file, folder package, Markdown, PDF; Pro upload/share path. | None. | At least manual export/package path needed; publish path needs scoped implementation/adapter. |
| F15 | macOS first version | macOS desktop app, Intel + Apple Silicon, older macOS compatibility considered. | Not a desktop app. | Need Tauri macOS app, bundle config, desktop self-test by opening app. |

## PRD Acceptance Indicators

| ID | Acceptance indicator | Current state |
| --- | --- | --- |
| A1 | Import 100 mixed HTML/Markdown files; 95% open/search/preview. | Not tested; importer missing. |
| A2 | MCP/CLI/HTTP/file-watch agent HTML enters Vault within 10 seconds with source, summary, thumbnail. | Missing. |
| A3 | Offline inbox fallback works and app later prompts to register. | Missing. |
| A4 | Registered local dashboard health-checks, starts, and shows cwd/log on failure. | Missing. |
| A5 | User can stop app-started local service and start it again. | Missing. |
| A6 | Intake of original HTML preserves content hash. | Missing. |
| A7 | Any original write shows diff first and supports write back, save-as, cancel. | Missing. |
| A8 | Import 100 old web/project dirs without modifying originals. | Missing. |
| A9 | External agent edits create snapshots; user can diff and roll back. | Missing. |
| A10 | Two HTML versions show source diff, content diff, DOM summary, and screenshot hint for complex pages. | Missing. |
| A11 | 300-1000 word diary generates at least two organization styles in 30 seconds and preserves original. | Missing. |
| A12 | Preview edit button allows direct text edit, then diff/write/save-as/cancel. | Missing. |
| A13 | Local HTML upload generates public link reachable outside local network. | Missing. |
| A14 | Import 30 Markdown notes preserving wikilinks, images, frontmatter, folder structure, code blocks, with at least 3 templates. | Missing. |
| A15 | User can create/edit HTML notes with Markdown syntax and `[[page]]` backlinks. | Missing. |
| A16 | Asset integrity check reports missing images, external scripts, and unpublishable resources. | Missing. |
| A17 | In 3 minutes: AI page enters Vault, version diff is visible, Markdown-style edit happens, export works. | Missing. |

## Technical Research Notes

Official Tauri v2 documentation confirms:

- Tauri macOS bundles default to macOS 10.13 minimum system version, configurable through `bundle.macOS.minimumSystemVersion`.
- Tauri sidecars require explicit command permissions and are the appropriate pattern for bundled external binaries.
- Tauri's filesystem plugin uses permissioned filesystem APIs and base directories, which fits Source Guard boundaries.

Official MCP TypeScript SDK documentation confirms:

- The TypeScript SDK supports building MCP servers with tools/resources and standard transports such as stdio and Streamable HTTP.

## Required Architecture Reset

Recommended path:

1. Keep the existing React UI code only as disposable prototype material.
2. Convert the project to Tauri v2 desktop app with `src-tauri/` Rust core.
3. Move privileged filesystem/process/service operations to Rust commands.
4. Use a local Vault store:
   - User-visible Vault directory.
   - `.htmlvault/` management directory.
   - `~/Library/Application Support/HtmlVault/agent-inbox/requests.jsonl` fallback inbox.
5. Add MCP/CLI/HTTP bridge as separate bounded modules.
6. Replace the textarea editor with a Markdown-first editing stack.
7. Build a PRD-sized test suite:
   - Rust unit tests for source guard, scanner, service registry, version store.
   - TypeScript unit/component tests for UI and editor behavior.
   - Integration tests for CLI/HTTP/inbox/MCP contracts.
   - Playwright/Tauri desktop tests that launch the actual app and exercise workflows.
   - Fixture-scale tests for 100 mixed files and 30 Markdown notes.

## Immediate Next Deliverables

1. Rewrite technical design around Tauri macOS desktop architecture.
2. Produce a PRD requirement matrix with test evidence fields.
3. Produce a multi-phase implementation plan where each PRD module has tests before code.
4. Only then implement the desktop app.

## Completion Rule

Do not mark this project complete until every acceptance indicator above has direct evidence from files, tests, command output, screenshots, or a launched desktop app run.
