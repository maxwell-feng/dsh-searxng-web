# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
