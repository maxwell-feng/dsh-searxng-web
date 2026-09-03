# Changelog

## [0.5.7] - 2026-09-03

### Changed / 变更

- **Compatibility: verified against deepseek-harness `0.1.2-rc.1` (latest `master`).** The seam (`ctx.web` search/fetch provider registry, `web` / `tool-web` rows, Schemastery config, SSRF guard, HTML→text, sticky `baseUrls` failover) is unchanged since `0.1.2-alpha.5`, and the vendored `@deepseek-ai/cordis` `4.0.2` / loader patch mechanism are unchanged — no code or config migration required. README/README.zh-CN requirements updated to `0.1.2-rc.1`; tests ALL PASS. **/ 兼容性：已在 deepseek-harness `0.1.2-rc.1` 最新 `master` 上验证。** 缝接口（`ctx.web` 搜索/抓取注册、`web` / `tool-web` 行、Schemastery 配置、SSRF 防护、HTML→文本、粘性 `baseUrls` 故障转移）自 `0.1.2-alpha.5` 以来未变，内置 `@deepseek-ai/cordis` `4.0.2` / loader 补丁机制亦未变化，无需代码或配置迁移。README/README.zh-CN 环境要求已更新为 `0.1.2-rc.1`；测试全部通过。

## [0.5.6] - 2026-09-02

### Changed / 变更

- **Compatibility: verified against deepseek-harness `0.1.2-alpha.5` (latest `master`).** Seam (`ctx.web` search/fetch provider registry, `web` / `tool-web` rows, Schemastery config, SSRF guard, HTML→text, sticky `baseUrls` failover) unchanged since `0.1.2-alpha.4` — no code or config migration required. README/README.zh-CN requirements updated to `0.1.2-alpha.5`. **/ 兼容性：已在 deepseek-harness `0.1.2-alpha.5` 最新 `master` 上验证。** 缝接口（`ctx.web` 搜索/抓取注册、`web` / `tool-web` 行、Schemastery 配置、SSRF 防护、HTML→文本、粘性 `baseUrls` 故障转移）自 `0.1.2-alpha.4` 以来未变，无需代码或配置迁移。README/README.zh-CN 环境要求已更新为 `0.1.2-alpha.5`。

## [0.5.5] - 2026-09-02

### Changed / 变更

- **Compatibility: verified against deepseek-harness `0.1.2-alpha.4` (latest `master`).** Seam (`ctx.web` search/fetch provider registry, `web` / `tool-web` rows, Schemastery config, SSRF guard, HTML→text, sticky `baseUrls` failover) unchanged since `0.1.2-alpha.3` — no code or config migration required. Bumped install tarball reference to `0.5.5` and completed bilingual six-section coverage (Release / Changelog / Install / Uninstall / Usage / Config — bilingual). **/ 兼容性：已在 deepseek-harness `0.1.2-alpha.4` 最新 `master` 上验证。** 缝接口（`ctx.web` 搜索/抓取注册、`web` / `tool-web` 行、Schemastery 配置、SSRF 防护、HTML→文本、粘性 `baseUrls` 故障转移）自 `0.1.2-alpha.3` 以来未变，无需代码或配置迁移。安装包引用升级至 `0.5.5`，并补齐双语六项覆盖（发行版 / 更新说明 / 安装 / 卸载 / 使用 / 配置——双语）。

## [0.5.4] - 2026-09-01

### Changed / 变更

- **Adapted to deepseek-harness `0.1.2-alpha.3` (master).** Between
  `0.1.2-alpha.2` and `0.1.2-alpha.3` the `ctx.web` seam
  (`registerSearchProvider` / `registerFetchProvider`), the `web` /
  `tool-web` config rows, and the provider contracts are unchanged —
  `packages/web` moved only its version pins in that release — so no plugin
  code changes were required. `@deepseek-ai/cordis` stays at `4.0.2` and
  `@deepseek-ai/schemastery` moves to `^3.18.2` (the revision the alpha.3
  checkout builds against); the committed `lib/index.js` is rebuilt and the
  full test suite passes against the new package set.
- **适配 deepseek-harness `0.1.2-alpha.3`（master）。** 从 `0.1.2-alpha.2`
  到 `0.1.2-alpha.3`，`ctx.web` 缝（`registerSearchProvider` /
  `registerFetchProvider`）、`web` / `tool-web` 配置行以及 provider 契约均
  未变化——该版本 `packages/web` 仅移动版本号——因此无需改动插件代码。
  `@deepseek-ai/cordis` 保持 `4.0.2`，`@deepseek-ai/schemastery` 升至
  `^3.18.2`（alpha.3 检出所依赖的 revision）；重新构建了随包提交的
  `lib/index.js`，全部测试在新区间依赖下通过。

## [0.5.3] - 2026-08-31

### Changed / 变更

- **Adapted to deepseek-harness `0.1.2-alpha.2` (master).** Between
  `0.1.2-alpha.1` and `0.1.2-alpha.2` the `ctx.web` seam
  (`registerSearchProvider` / `registerFetchProvider`), the `web` /
  `tool-web` config rows, and the provider contracts are unchanged, so no
  plugin code changes were required. `devDependencies` now pin
  `@deepseek-ai/cordis` at `4.0.2`; the committed `lib/index.js` is rebuilt
  and the full test suite passes against the new package set.
- **适配 deepseek-harness `0.1.2-alpha.2`（master）。** 从 `0.1.2-alpha.1`
  到 `0.1.2-alpha.2`，`ctx.web` 缝（`registerSearchProvider` /
  `registerFetchProvider`）、`web` / `tool-web` 配置行以及 provider 契约均
  未变化，因此无需改动插件代码。`devDependencies` 锁定
  `@deepseek-ai/cordis` 至 `4.0.2`；重新构建了随包提交的 `lib/index.js`，
  全部测试在新区间依赖下通过。

## [0.5.2] - 2026-08-30

### Changed

- README: install section aligned with the `dsh-tinyfish-search` layout —
  `dsh plugin add` plus repository / tarball / `github:` alternatives
  (README.md and README.zh-CN.md).

## [0.5.1] - 2026-08-30

### Changed

- **npm package renamed: dropped the `@maxwell-feng/` scope.** The package is
  now published as **`dsh-searxng-web`** (aligned with the unscoped
  `dsh-tinyfish-search` convention). All install commands, badges and docs
  use the new name; the old `@maxwell-feng/dsh-searxng-web` package is
  deprecated. No code, config or behavior changes — the bundle layer,
  provider ids (`searxng-web` / `searxng-web-fetch`) and install steps are
  identical apart from the name.

## [0.5.0] - 2026-08-29

### Compatibility

- **Adapted to deepseek-harness `0.1.2-alpha.1` (master)**: the `ctx.web`
  seam (`registerSearchProvider` / `registerFetchProvider`) and the `web` /
  `tool-web` config rows are unchanged from `0.4.0` — provider registration
  now returns fiber-scoped disposers, which the plugin's registrations rely
  on as before.
- `web_fetch` now reports the final URL after redirects (`Response.url`) in
  the result's `url` field, matching the current `dsh-web` seam contract
  ("the final URL after allowed redirects").
- `@deepseek-ai/cordis` stays `4.0.1`.

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.4.0] - 2026-08-24

### Added

- **Multi-endpoint sticky failover** via the new `baseUrls` config field —
  an ordered endpoint list for instances reachable through several doors at
  once (public IPv4 + public IPv6 + LAN is the canonical triple-stack):
  - Attempts start at the last endpoint that succeeded (sticky) and walk the
    remaining list once per call.
  - Only network-level failures (connection refused / unreachable / timeout /
    DNS) advance to the next endpoint; any HTTP answer proves the door is
    alive and its status is surfaced as-is, so auth problems are never masked.
  - When every endpoint is unreachable a single `network`-classified error is
    raised after one full pass.
  - `baseUrls` takes precedence over `baseUrl` when non-empty; entries are
    trimmed and de-duplicated. Single-`baseUrl` configurations behave exactly
    as before.

### Changed

- Provider `available()` now reflects the resolved endpoint list; the load
  log line reports the endpoint count and primary door.

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
