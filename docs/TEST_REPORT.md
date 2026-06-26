# Test Report

Date: 2026-06-26

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
