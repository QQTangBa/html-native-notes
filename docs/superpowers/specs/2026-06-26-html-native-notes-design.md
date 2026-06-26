# HTML Native Notes Design

Date: 2026-06-26
Status: Draft, awaiting user review

## Scope

Build a local-first open-source web application under `html-native-notes/`. The current project root has no discovered PRD file, so this design uses the thread objective and the AI-era HTML note engine product thesis as PRD v0.

## Recommended Product Shape

The application should open directly into a note workspace. The core layout is a left note library, a center HTML source editor, and a right live preview / AI actions panel. Notes are stored locally as HTML files with metadata, and AI features are optional until the user configures an OpenAI-compatible provider.

UI and interaction changes must use Product Design judgment. The default design brief is a full-interactivity local editor with no external visual source, aiming for a polished, professional, editor-like product rather than a rough internal tool.

## Alternatives

1. Pure static browser app: simplest, but weak local file persistence and risky key handling.
2. Electron/Tauri desktop app: strong local UX, but premature packaging complexity.
3. Node local web app: best v0 trade-off, with clear file persistence, secret-safe backend, and straightforward tests.

Chosen approach: Node local web app with React, Vite, TypeScript, Fastify, CodeMirror, Vitest, and Playwright.

## Architecture

Frontend modules handle notes, editor, preview, AI actions, settings, shared API calls, and shared UI. Backend modules handle local config, note storage, notes routes, AI routes, and security utilities. The browser never receives raw AI keys; all provider calls go through the local backend.

## Data Flow

Create/edit/delete note flows go through typed frontend API calls to Fastify routes, then into a scoped filesystem note store. Preview updates locally through sanitized HTML and an iframe. AI flows send an explicit action and context to the backend, which validates configuration, calls the configured model provider, and returns a result for user review before insertion.

## Error Handling

All backend errors use a stable `{ error: { code, message, details? } }` shape. Expected failures include missing AI config, invalid note IDs, unsafe import content, path traversal attempts, provider timeout, and malformed provider responses.

## Testing

Use TDD for implementation. Unit tests cover config parsing, note store behavior, sanitizer, and AI request building. Integration tests cover notes CRUD, import/export, config status, and AI endpoint errors. Playwright covers startup and the main create-edit-preview-save flow.

## User Review Gate

Before writing implementation code, the user should review this design plus `docs/TECHNICAL_DESIGN.md`. After approval, create a detailed implementation plan in `docs/superpowers/plans/`.
