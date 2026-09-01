# dsh-searxng-web

English | [简体中文](README.zh-CN.md)

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![npm version](https://img.shields.io/npm/v/dsh-searxng-web)](https://www.npmjs.com/package/dsh-searxng-web)
[![npm downloads](https://img.shields.io/npm/dm/dsh-searxng-web)](https://www.npmjs.com/package/dsh-searxng-web)
[![CI](https://github.com/maxwell-feng/dsh-searxng-web/actions/workflows/ci.yml/badge.svg)](https://github.com/maxwell-feng/dsh-searxng-web/actions/workflows/ci.yml)
[![Publish](https://github.com/maxwell-feng/dsh-searxng-web/actions/workflows/publish.yml/badge.svg)](https://github.com/maxwell-feng/dsh-searxng-web/actions/workflows/publish.yml)
[![License](https://img.shields.io/github/license/maxwell-feng/dsh-searxng-web)](LICENSE)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin
that backs the **native `web_search` / `web_fetch` tools** with your own
self-hosted [SearXNG](https://docs.searxng.org) instance — keyless, private,
no third-party search vendor.

```
model ── web_search ──▶ ctx.web ──▶ searxng-web provider ──▶ your SearXNG ──▶ engines
model ── web_fetch ──▶ ctx.web ──▶ searxng-web-fetch ──▶ target page (SSRF-guarded)
```

## Why

- dsh ships `web_search` pointed at the DeepSeek cloud search, and mounts no
  fetch provider at all. If you run SearXNG for privacy or offline use, your
  queries still leak to a vendor — until this bundle is installed.
- Unlike an MCP server integration, this rides dsh's own provider seam: the
  model keeps using the short native tool names (`web_search`, `web_fetch`),
  every agent and subagent inherits it, and nothing extra runs alongside dsh.

## Requirements

- Node.js ≥ 20
- DeepSeek Harness `dsh` installed (verified on `0.1.2-alpha.3`)
- A reachable SearXNG instance with JSON output enabled
  (`settings.yml` → `search.formats: [html, json]`), verified by:

  ```sh
  curl 'http://YOUR_SEARXNG:8080/search?q=test&format=json'
  ```

## Install

### From npm (recommended)

```sh
dsh plugin --profile web add dsh-searxng-web
```

(Replace `web` with your profile, e.g. `tui`.) Published from CI with
Sigstore provenance; the package ships a prebuilt `lib/`, so nothing needs
to be compiled or allowlisted on install.

or from the repository / a tarball:

```sh
dsh plugin --profile web add ./dsh-searxng-web        # source checkout
dsh plugin --profile web add ./dsh-searxng-web-0.5.2.tgz
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# or pin a commit:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

> Git installs fetch sources: the repository commits the compiled `lib/`
> output, so git installs load without any build step — there is no `prepare`
> script, so pnpm `allowBuilds` is never needed either.

### Upgrading

```sh
dsh plugin --profile web add dsh-searxng-web@latest
# or from git, to pick up changes before they reach npm:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
```

0.2.x configurations keep working unchanged — every field added since is
optional with identical defaults. Since 0.3.0 configuration is validated at
load time (Schemastery schema), a mistyped key fails the boot with an
actionable error instead of being silently ignored. 0.4.0 adds the optional
`baseUrls` failover list; single-`baseUrl` setups are unaffected. 0.5.0
adapts to deepseek-harness `0.1.2-alpha.1` (fiber-scoped provider
disposers, post-redirect `url` reporting) — no config changes required.
0.5.3 adapts to deepseek-harness `0.1.2-alpha.2` — the seam and config
rows are unchanged, only the dependency pins move.
0.5.4 adapts to deepseek-harness `0.1.2-alpha.3` — `packages/web` moved
only its version pins in that release, so again no config changes required.

Installing does three things (via the bundled patch layer):

1. inserts the `searxng-web` plugin row;
2. points `ctx.web` at its search/fetch providers;
3. re-enables `web_fetch` (`tool-web.fetch`).

Then boot as usual:

```sh
dsh --profile web
```

New sessions now answer "search xxx" through your instance. Verify in the
compose output any time:

```sh
dsh --profile web --dump-config | grep -A5 searxng
```

### Pointing at your instance

The default base URL is `http://127.0.0.1:8080`. Override it (and anything
else) in your profile's `cordis.patch.yml` — the user layer applies after
bundle layers:

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://10.42.1.159:8080'
    timeoutMs: 15000        # per-search budget, ms
    fetchTimeoutMs: 30000   # per-fetch budget, ms
    fetchMaxChars: 200000   # cap on web_fetch output characters
    ssrfGuard: true         # refuse private/loopback fetch targets
    search:                 # forwarded to SearXNG on every query (all optional)
      language: ''          # e.g. 'zh-CN', 'en'
      safesearch: 0         # 0 off, 1 moderate, 2 strict
      # categories: 'general'   # 'news', 'it,science', ...
      # engines: ''             # 'google,bing,ddg', ...
      # timeRange: ''           # 'day' | 'week' | 'month' | 'year'
```

Patch rows replace config wholesale (no deep merge) — restate keys you want
to keep when overriding.

### Triple-stack endpoints with automatic failover (0.4.0+)

Home instances often live behind several doors at once — a public IPv4, a
public IPv6 and a LAN address. `baseUrls` takes an ordered list and fails
over automatically:

```yaml
- id: searxng-web
  config:
    baseUrls:
      - 'http://203.0.113.10:8081/s/<KEY>'      # public IPv4
      - 'http://[2409:8a55:…]:8081/s/<KEY>'     # public IPv6
      - 'http://192.168.10.144:8081/s/<KEY>'    # LAN (same door, same key)
    timeoutMs: 15000
```

Semantics:

- **Sticky**: attempts always start at the last endpoint that succeeded, so a
  healthy door is never re-probed after an earlier entry had a hiccup.
- **Fail fast on the wire only**: connection refused / unreachable / timeout /
  DNS failure advance to the next endpoint. Any HTTP answer (200, 403, 502…)
  proves that door is alive and its status is surfaced as-is — no silent
  masking of auth problems.
- One full pass over the list per call; if every endpoint is unreachable you
  get a single `network` error.
- `baseUrls` wins when both it and `baseUrl` are set; `baseUrl` alone keeps
  working exactly as before.

## Configuration reference

| Key | Default | Description |
|---|---|---|
| `baseUrl` | `http://127.0.0.1:8080` | SearXNG instance URL |
| `baseUrls` | *(unset)* | Ordered endpoint list with sticky automatic failover (0.4.0+); takes precedence over `baseUrl` when non-empty — see "Triple-stack endpoints" above |
| `timeoutMs` | `15000` | Per-search attempt budget (ms) |
| `fetchTimeoutMs` | `30000` | Per-fetch attempt budget (ms) |
| `fetchMaxChars` | `200000` | Max characters returned by `web_fetch` |
| `ssrfGuard` | `true` | Refuse private/loopback/link-local/CGNAT fetch targets |
| `search.language` | *(unset)* | SearXNG `language` param |
| `search.safesearch` | `0` | SearXNG `safesearch` param |
| `search.categories` | *(unset)* | SearXNG `categories` param |
| `search.engines` | *(unset)* | SearXNG `engines` param |
| `search.timeRange` | *(unset)* | SearXNG `time_range` param |
| `headers` | *(unset)* | Extra HTTP headers attached to **SearXNG requests only** (e.g. `X-API-Key` gates) — never sent to `web_fetch` targets |
| `basicAuth.username` / `basicAuth.password` | *(unset)* | Basic-auth credentials for instances behind an authenticating reverse proxy (caddy `basic_auth`, nginx `auth_basic`) |

## API keys & authenticated reverse proxies

Three supported ways to put a gate in front of the instance. Credentials
configured here ride **only** on requests to your SearXNG instance;
`web_fetch` targets (model-chosen third-party pages) always stay
credential-free.

1. **Header gate** (recommended for API consumers):

   ```yaml
   config:
     baseUrl: 'http://searx.internal:8080'
     headers:
       X-API-Key: 'your-key'
   ```

   Pair it with a caddy check, e.g.
   [`caddy-l4`/`forward_auth`](https://caddyserver.com/docs/caddyfile/directives/forward_auth)
   or a small middleware that compares the header.

2. **Basic-auth reverse proxy** (caddy `basic_auth`, nginx `auth_basic`):

   ```yaml
   config:
     baseUrl: 'http://searx.internal:8080'
     basicAuth:
       username: 'searxng'
       password: 'hunter2'
   ```

   Setting both `basicAuth` and a user-supplied `headers.Authorization`
   fails at load time with an actionable error.

3. **Path-prefix key** (no plugin config needed): if your reverse proxy
   strips a secret prefix before proxying, just include it in `baseUrl`,
   e.g. `baseUrl: 'http://host:8081/s/<KEY>'`. Works because the search
   adapter appends `/search?...` to whatever base you give it.

> Node's `fetch` refuses URLs that embed credentials (`http://user:pass@…`),
> which is why auth lives in dedicated config fields instead of `baseUrl`.

## Behavior notes & limits

- **Search**: maps SearXNG results to `{url, title?, snippet?, publishedAt?}`
  and surfaces the SearXNG `answer` line when present.
- **Fetch**: GET with a browser-ish User-Agent; HTML is reduced to readable
  text; output capped at `fetchMaxChars` (`truncated` flag set).
- **SSRF guard**: validates the initial target only — redirects are followed
  without re-validation (v1 limitation). The guard also blocks non-http(s)
  protocols and unresolvable hosts. Disable only on closed deployments.
- **Proxy**: uses Node's global `fetch`, which ignores system proxies and
  proxy env vars by default — SearXNG traffic always goes direct. Provider
  APIs behind a proxy are unaffected because this plugin talks only to your
  instance and fetched pages.
- **403 from SearXNG**: JSON output is disabled on the instance — see
  Requirements above.

## Migrating from an MCP-based SearXNG integration

If you previously wired SearXNG through an MCP server (e.g.
[`mcp-searxng`](https://github.com/ihor-sokoliuk/mcp-searxng) via a
`dsh-mcp-client` row), remove that integration when you install this plugin:

- The model would otherwise see **two overlapping search tools** (native
  `web_search` and `mcp__searxng__searxng_web_search`) plus several extra
  schemas — ambiguous tool selection and ~1–2k tokens of per-request
  overhead for no search-quality gain (both hit the same instance).
- To remove: delete the `dsh-mcp-client` insert row from your profile's
  `cordis.patch.yml` (HMR unregisters the tools immediately) and optionally
  `npm uninstall -g mcp-searxng`.

What you give up: the MCP reader's PDF extraction and section filtering.
The native `web_fetch` covers plain HTML/text pages; if you later need PDF
reading again, re-adding the MCP row takes minutes.

## Uninstall

```sh
dsh plugin --profile web remove dsh-searxng-web
```

Removes both the dependency and the bundle layer. `ctx.web` falls back to
the base composition (DeepSeek search, no fetch provider).

## Development

The plugin is written in TypeScript (`src/index.ts`); the compiled
`lib/index.js` is committed so installs never need a build.

```sh
npm install          # dev dependencies (typescript, @types/node, cordis types)
npm run build        # compile src/ → lib/
npm test             # build + self-contained offline test suite (mock SearXNG)
```

## Release process (maintainers)

Bump `version` in `package.json`, add a `CHANGELOG.md` entry, then:

```sh
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

GitHub Actions runs the standalone test suite and publishes to npm via OIDC
trusted publishing (Sigstore provenance) — the same pipeline as
[`dsh-windows-ocr`](https://github.com/maxwell-feng/dsh-windows-ocr).

## License

[MIT](LICENSE)
