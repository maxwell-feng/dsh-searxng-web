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
- A reachable SearXNG instance with JSON output enabled
  (`settings.yml` → `search.formats: [html, json]`), verified by:

  ```sh
  curl 'http://YOUR_SEARXNG:8080/search?q=test&format=json'
  ```

## Install

```sh
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# or pin a commit:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

The package ships plain JavaScript (no build step), so no pnpm build
allowlist is needed.

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

## Uninstall

```sh
dsh plugin --profile web remove @maxwell-feng/dsh-searxng-web
```

Removes both the dependency and the bundle layer. `ctx.web` falls back to
the base composition (DeepSeek search, no fetch provider).

## License

[MIT](LICENSE)
