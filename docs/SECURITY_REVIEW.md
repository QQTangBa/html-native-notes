# Security Review

Date: 2026-06-26

## Scope

Reviewed the local web app security posture for v0: filesystem note storage, HTML preview, AI configuration, local server behavior, and dependency status.

## Findings

- Secrets: `AI_API_KEY` is read from `.env.local` or process env and is not exposed by config status APIs.
- Git hygiene: `.env.local`, `data/`, build output, Playwright output, and logs are gitignored.
- Preview sandbox: preview rendering uses sanitized HTML and an iframe with an empty `sandbox` attribute.
- Sanitization: script tags, dangerous embeds, `srcdoc`, and common inline event handlers are removed before preview.
- Filesystem scope: note IDs and filenames are validated; note files are resolved under app-owned data directories.
- Concurrent writes: metadata-changing operations are serialized to avoid lost writes.
- Dependency audit: `npm audit --audit-level=moderate` reports 0 vulnerabilities.

## Verified Scenarios

- Script tag and inline `onclick` content do not appear in preview iframe `srcdoc`.
- Missing AI API key returns a structured `AI_CONFIG_ERROR` without leaking configuration.
- AI status endpoint returns configured/model status without the API key.
- Path traversal note IDs are rejected by unit tests.

## Residual Risks

- Sanitization is intentionally conservative but not a full browser isolation story for arbitrary hostile documents. v0 disables scripts in preview; future import/export features should preserve this stance unless there is a separate trusted-mode design.
- Local server is intended for `127.0.0.1`; exposing it on a network interface would require additional review.
- `.env.local` must stay local-only. Do not paste real keys into README, tests, screenshots, or issue logs.
