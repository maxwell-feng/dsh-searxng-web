# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-08-23

### Added

- Instance authentication, for deployments behind an API-key gate or an
  authenticating reverse proxy (searxng + caddy/nginx):
  - `headers` — extra HTTP headers attached to SearXNG requests only
    (e.g. `X-API-Key`).
  - `basicAuth.username` / `basicAuth.password` — sets the Authorization
    header for caddy `basic_auth` / nginx `auth_basic` front doors.
  - Credentials never ride on `web_fetch` requests (model-chosen
    third-party pages must stay credential-free). Setting both `basicAuth`
    and a user-supplied `headers.Authorization` fails at load time.
- A Schemastery `Config` schema per the dsh plugin docs
  (`docs/user/develop/basic/config`): configuration is now validated at load
  time with actionable errors; defaults mirror the previous defensive
  fallbacks, so existing configs behave identically.

### Changed

- The 403 error message now distinguishes "credentials rejected" from "JSON
  output disabled" when instance credentials are configured.
- New dependency: `@deepseek-ai/schemastery` (runtime, used by the loader).

## [0.2.0] - 2026-08-23

### Changed

- **Rewritten in TypeScript** (`src/index.ts` → committed `lib/index.js`).
  Same runtime behavior; the codebase now has full strict-mode types for the
  config, the ctx.web provider contracts, and the SearXNG JSON response.
- Installs still need no build: `lib/` is committed, so npm and git installs
  load the prebuilt entry directly (no `prepare` script, no pnpm
  `allowBuilds` entry).

### Added

- `tsconfig.json` (strict, NodeNext) and a `Development` section in both
  READMEs (`npm run build` / `npm test`).
- CI compiles the TypeScript source before running the test suite
  (`npm ci` → `npm test` in both workflows).

## [0.1.1] - 2026-08-23

### Changed

- Documentation: npm install is now the recommended method (GitHub install
  kept as an alternative); requirements note the verified dsh version
  (`0.1.1-rc.2`); added a maintainer release-process section.
- CI: publish workflow mirrors `@maxwell-feng/dsh-windows-ocr` — `v*` tags
  trigger tests + npm publish via OIDC trusted publishing; standalone test
  suite made fully offline/self-contained.

## [0.1.0] - 2026-08-23

### Added

- `ctx.web` search provider (`searxng-web`) backed by the SearXNG JSON API:
  the native `web_search` tool now executes against your own instance —
  keyless, self-hosted, no third-party search vendor.
- `ctx.web` fetch provider (`searxng-web-fetch`): a bounded GET reader for
  the native `web_fetch` tool. HTML responses are reduced to readable text
  (script/style stripped, tags removed, entities decoded) and capped at
  `fetchMaxChars`.
- SSRF guard on `web_fetch` targets (private / loopback / link-local /
  CGNAT ranges refused by default; disable with `ssrfGuard: false`).
- Configurable search defaults forwarded to SearXNG per query: `language`,
  `safesearch`, `categories`, `engines`, `timeRange`.
- Bundle ships a ready-made patch layer: installing it points `ctx.web` at
  SearXNG and re-enables `web_fetch` — no extra wiring needed.
- Bilingual README (English / 简体中文).
