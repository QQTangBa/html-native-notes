# Test Report

Date: 2026-06-26

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

Agent Bridge HTTP fallback evidence:

```bash
npm run test:bridge
```

Result: PASS. 2 files, 10 tests. This proves the shared protocol and local HTTP fallback server support:

- `GET /health`
- `POST /api/agent/register-html`
- `POST /api/agent/register-service`
- stable validation errors for invalid registrations

This still does not prove MCP, CLI, offline inbox, file watching, Vault insertion, thumbnail generation, or 10-second desktop acceptance.

Latest full non-Rust validation:

```bash
npm run typecheck
npm run test
npm run lint
```

Result: PASS. Full test run: 9 files, 35 tests.

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
