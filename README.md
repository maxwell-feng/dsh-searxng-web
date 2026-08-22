# @maxwell-feng/dsh-searxng-web

English | [简体中文](README.zh-CN.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin
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
- DeepSeek Harness `dsh` installed (verified on `0.1.1-rc.2`)
- A reachable SearXNG instance with JSON output enabled
  (`settings.yml` → `search.formats: [html, json]`), verified by:

  ```sh
  curl 'http://YOUR_SEARXNG:8080/search?q=test&format=json'
  ```

## Install

### From npm (recommended)

```sh
dsh plugin --profile web add @maxwell-feng/dsh-searxng-web
```

(Replace `web` with your profile, e.g. `tui`.) Published from CI with
Sigstore provenance; the package ships a prebuilt `lib/`, so nothing needs
to be compiled or allowlisted on install.

### From GitHub

```sh
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# or pin a commit:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

The repository commits the compiled `lib/` output, so git installs also load
without any build step or pnpm `allowBuilds` allowlist.

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

## Configuration reference

| Key | Default | Description |
|---|---|---|
| `baseUrl` | `http://127.0.0.1:8080` | SearXNG instance URL |
| `timeoutMs` | `15000` | Per-search attempt budget (ms) |
| `fetchTimeoutMs` | `30000` | Per-fetch attempt budget (ms) |
| `fetchMaxChars` | `200000` | Max characters returned by `web_fetch` |
| `ssrfGuard` | `true` | Refuse private/loopback/link-local/CGNAT fetch targets |
| `search.language` | *(unset)* | SearXNG `language` param |
| `search.safesearch` | `0` | SearXNG `safesearch` param |
| `search.categories` | *(unset)* | SearXNG `categories` param |
| `search.engines` | *(unset)* | SearXNG `engines` param |
| `search.timeRange` | *(unset)* | SearXNG `time_range` param |

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
dsh plugin --profile web remove @maxwell-feng/dsh-searxng-web
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
[`@maxwell-feng/dsh-windows-ocr`](https://github.com/maxwell-feng/dsh-windows-ocr).

## License

[MIT](LICENSE)
