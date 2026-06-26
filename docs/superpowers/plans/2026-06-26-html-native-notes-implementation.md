# HTML Native Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local runnable open-source HTML-native note editor with local note storage, source editing, sanitized preview, user-configured AI actions, documentation, and verification.

**Architecture:** A Vite React frontend talks to a Fastify local backend. The backend owns filesystem persistence, AI provider secrets, OpenAI-compatible model calls, and safe config status. The frontend owns the note workspace, editor state, preview rendering, settings, and AI result review.

**Tech Stack:** Node.js, TypeScript, React, Vite, Fastify, CodeMirror 6, Zod, DOMPurify, Vitest, Supertest, Playwright, ESLint, Prettier.

**Product Design Rule:** For every page interaction, UI, visual polish, or product experience change, apply Product Design plugin guidance. The UI should feel like a polished professional editor, not a rough demo.

---

## File Structure

- Create `package.json`: scripts, dependencies, project metadata.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`.
- Create `index.html`: Vite mount point.
- Create `src/shared/types.ts`: `NoteMeta`, API response, AI types.
- Create `src/server/config.ts`: env parsing and safe AI status.
- Create `src/server/storage/noteStore.ts`: scoped filesystem note persistence.
- Create `src/server/security/htmlSanitizer.ts`: reusable HTML sanitization.
- Create `src/server/ai/openAiCompatibleClient.ts`: provider client and action prompt builder.
- Create `src/server/routes/*.ts`: health, config, notes, AI route modules.
- Create `src/server/index.ts`: server factory and CLI start.
- Create `src/shared/api/client.ts`: typed browser API client.
- Create `src/features/*`: React feature components for notes, editor, preview, AI, and settings.
- Create `src/app/App.tsx`, `src/main.tsx`, `src/styles.css`: application shell.
- Create `tests/unit/*.test.ts`, `tests/integration/*.test.ts`, `tests/e2e/*.spec.ts`.
- Create `docs/TEST_REPORT.md`, `docs/SECURITY_REVIEW.md`: self-test output and security review.
- Modify `README.md`: install, run, config, usage, development structure, FAQ.
- Modify `docs/TECHNICAL_DESIGN.md`: update if implementation contracts diverge.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Write minimal scaffold files**

Create scripts:

```json
{
  "scripts": {
    "dev": "tsx src/server/index.ts",
    "dev:client": "vite --host 127.0.0.1",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "verify": "npm run typecheck && npm run test && npm run build"
  }
}
```

- [ ] **Step 2: Install dependencies inside `html-native-notes/`**

Run:

```bash
npm install @codemirror/lang-html @codemirror/state @codemirror/view @fastify/cors @vitejs/plugin-react dompurify fastify lucide-react react react-dom zod
npm install -D @playwright/test @testing-library/jest-dom @testing-library/react @types/dompurify @types/node @types/react @types/react-dom eslint jsdom prettier supertest tsx typescript vite vitest
```

- [ ] **Step 3: Run baseline commands**

Run:

```bash
npm run typecheck
npm run test
```

Expected: no tests or placeholder app compile successfully after files exist.

## Task 2: Shared Types and Config Loader

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/server/config.ts`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Test cases:

- default host `127.0.0.1` and port `5178`
- valid AI status hides API key
- invalid temperature throws a typed config error

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- tests/unit/config.test.ts
```

Expected: FAIL because `loadConfig` does not exist.

- [ ] **Step 3: Implement types and config loader**

Implement `loadConfig(env = process.env)` and `getSafeAiStatus(config)`.

- [ ] **Step 4: Run green test**

Run:

```bash
npm run test -- tests/unit/config.test.ts
```

Expected: PASS.

## Task 3: Note Store

**Files:**
- Create: `src/server/storage/noteStore.ts`
- Test: `tests/unit/noteStore.test.ts`

- [ ] **Step 1: Write failing note store tests**

Test cases:

- creates metadata and standalone HTML file
- updates content and `updatedAt`
- duplicates note with a new ID and title
- archives note to trash on delete
- rejects path traversal IDs and filenames

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- tests/unit/noteStore.test.ts
```

Expected: FAIL because note store does not exist.

- [ ] **Step 3: Implement note store**

Use `fs/promises`, safe path joins, atomic writes via temporary files, and metadata stored in `metadata.json`.

- [ ] **Step 4: Run green test**

Run:

```bash
npm run test -- tests/unit/noteStore.test.ts
```

Expected: PASS.

## Task 4: Sanitizer and AI Client

**Files:**
- Create: `src/server/security/htmlSanitizer.ts`
- Create: `src/server/ai/openAiCompatibleClient.ts`
- Test: `tests/unit/htmlSanitizer.test.ts`
- Test: `tests/unit/aiClient.test.ts`

- [ ] **Step 1: Write failing sanitizer and AI tests**

Test cases:

- removes `<script>`
- removes inline event handlers
- preserves safe HTML structure and inline CSS
- maps `summarize`, `rewrite`, `outline`, `translate`, `generate-section`, `clean-html` to prompts
- throws a clear error when AI config misses key

- [ ] **Step 2: Run red tests**

Run:

```bash
npm run test -- tests/unit/htmlSanitizer.test.ts tests/unit/aiClient.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement sanitizer and AI client**

Use DOMPurify with JSDOM for server-side sanitization. Use `fetch` for OpenAI-compatible `/chat/completions` requests.

- [ ] **Step 4: Run green tests**

Run:

```bash
npm run test -- tests/unit/htmlSanitizer.test.ts tests/unit/aiClient.test.ts
```

Expected: PASS.

## Task 5: Fastify API

**Files:**
- Create: `src/server/routes/health.ts`
- Create: `src/server/routes/config.ts`
- Create: `src/server/routes/notes.ts`
- Create: `src/server/routes/ai.ts`
- Create: `src/server/index.ts`
- Test: `tests/integration/api.test.ts`

- [ ] **Step 1: Write failing API integration tests**

Test cases:

- `GET /api/health`
- note create/list/read/save/duplicate/delete
- AI status hides secret
- AI action returns clear missing-key error

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- tests/integration/api.test.ts
```

Expected: FAIL because server factory does not exist.

- [ ] **Step 3: Implement Fastify server and routes**

Export `createServer(options)` for tests and start only when `src/server/index.ts` is run directly.

- [ ] **Step 4: Run green test**

Run:

```bash
npm run test -- tests/integration/api.test.ts
```

Expected: PASS.

## Task 6: Frontend Workspace

**Files:**
- Create: `src/shared/api/client.ts`
- Create: `src/features/notes/NoteLibrary.tsx`
- Create: `src/features/editor/HtmlEditor.tsx`
- Create: `src/features/preview/PreviewPane.tsx`
- Create: `src/features/ai/AiPanel.tsx`
- Create: `src/features/settings/SettingsPanel.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles.css`
- Test: `tests/unit/App.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Test cases:

- renders workspace columns
- create note button calls API and opens returned note
- editor change updates preview text
- settings panel shows AI configured/missing state

- [ ] **Step 2: Run red test**

Run:

```bash
npm run test -- tests/unit/App.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement frontend components**

Build a dense but polished Product Design-informed application UI with stable panels, icon buttons, clear affordances, loading states, empty states, and error banners.

- [ ] **Step 4: Run green test**

Run:

```bash
npm run test -- tests/unit/App.test.tsx
```

Expected: PASS.

## Task 7: E2E and Runtime Verification

**Files:**
- Create: `tests/e2e/workspace.spec.ts`
- Create: `tests/e2e/security.spec.ts`
- Modify: `playwright.config.ts`
- Create: `docs/TEST_REPORT.md`
- Create: `docs/SECURITY_REVIEW.md`

- [ ] **Step 1: Write Playwright tests**

Test cases:

- app starts
- creates note
- edits HTML
- preview updates
- save persists after reload
- script import/preview does not execute

- [ ] **Step 2: Run E2E**

Run:

```bash
npm run test:e2e
```

Expected: PASS after server starts through Playwright webServer.

- [ ] **Step 3: Run live AI config test**

Run:

```bash
node scripts/test-ai-config.mjs
```

Expected: either PASS against configured DeepSeek `.env.local` or a documented provider/network failure without leaking key.

- [ ] **Step 4: Update reports**

Write exact command results and any residual risks to `docs/TEST_REPORT.md` and `docs/SECURITY_REVIEW.md`.

## Task 8: README, Final Verification, and GitHub Prep

**Files:**
- Modify: `README.md`
- Modify: `docs/TECHNICAL_DESIGN.md`
- Modify: `docs/TEST_REPORT.md`
- Modify: `docs/SECURITY_REVIEW.md`

- [ ] **Step 1: Complete README**

Include installation, running, AI config, usage, development structure, tests, troubleshooting, and FAQ.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run verify
npm run test:e2e
git status --short --ignored
```

Expected: all tests pass; `.env.local` ignored; only intended project files are untracked/modified.

- [ ] **Step 3: Prepare GitHub**

After local verification, create a standalone open-source GitHub repository and push only tracked project files, excluding `.env.local`.

## Self-Review

- Spec coverage: the plan covers local runnable software, open-source mode, user AI config, README, self-tests, security checks, and GitHub prep.
- Placeholder scan: no task relies on "TBD" or unnamed modules.
- Type consistency: shared contracts are `NoteMeta`, `AiRuntimeConfig`, `SafeAiStatus`, `ApiErrorBody`, and note/AI endpoint payloads.
- Known risk: the current PRD was reconstructed because no PRD file exists in the root. If a real PRD appears, update `docs/TECHNICAL_DESIGN.md` and this plan before continuing.
