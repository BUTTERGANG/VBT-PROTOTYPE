# Changelog

All notable changes to VBT-PROTOTYPE. Newest first.

## 2026-10-23 — Security: dependency vulnerability fixes

Known advisories (OSV) in lockfiles: **7 critical, 53 high, 27 moderate, 9 low, 4 unrated → none**.

- `vision-pipeline/uv.lock`: `pillow` 13.0.0, `certifi` 2026.10.19 (criticals), `urllib3` 2.8.0, `filelock`, `setuptools`
- `backend`: lockfile URLs moved off Replit's package firewall; `npm audit fix` (`proxy-addr`, `body-parser`)
- `pwa`: `npm audit fix` (`vite`, `react-router`, `postcss`, …)
- Critical/high advisories cleared in: `certifi`, `pillow`, `proxy-addr`, `body-parser`, `brace-expansion`, `browserslist`, `fast-uri`, `filelock`, `nanoid`, `postcss`, `react-router`, `source-map-js`, `urllib3`, `vite`, `zod`
- Verified: vision-pipeline 37/37 tests and pwa build pass. backend `tsc` fails on a pre-existing config error (TS1343 `import.meta` with the current `module` setting), identical before
