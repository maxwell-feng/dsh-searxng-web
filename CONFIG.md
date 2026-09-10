# Configuration Guide

English | [中文](CONFIG.zh.md)

All options live on the `searxng-web` row of a `cordis.patch.yml`
(profile, home, or `--patch` overlay) and are validated at load time by
the Schemastery `Config` schema in `src/index.ts`. Defaults below are
byte-exact with both the schema and the defensive fallbacks in `apply()`.

## Full option table

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `'http://127.0.0.1:8080'` | Single SearXNG instance base URL. Trailing slashes are stripped. |
| `baseUrls` | `string[]` | *(unset)* | Ordered endpoints with sticky automatic failover. Non-empty wins over `baseUrl`; entries are trimmed and de-duplicated. |
| `timeoutMs` | `number` | `15000` | Per-search-attempt budget, ms. Non-positive values fall back to `15000`. |
| `fetchTimeoutMs` | `number` | `30000` | Per-fetch-attempt budget, ms. Non-positive values fall back to `30000`. |
| `fetchMaxChars` | `number` | `200000` | Cap on characters returned by `web_fetch`. Non-positive values fall back to `200000`. |
| `ssrfGuard` | `boolean` | `true` | Refuse private/loopback/link-local/CGNAT `web_fetch` targets. Set `false` only on closed deployments. |
| `headers` | `Record<string, string>` | *(unset)* | Extra headers on **SearXNG requests only** (e.g. `X-API-Key`). Never sent to `web_fetch` targets. Non-string values are ignored. |
| `basicAuth.username` | `string` | *(unset)* | Basic-auth username for instances behind an authenticating reverse proxy. |
| `basicAuth.password` | `string` | *(unset)* | Basic-auth password for instances behind an authenticating reverse proxy. |
| `search.language` | `string` | *(unset)* | Forwarded as SearXNG `language`. Blank values are skipped. |
| `search.safesearch` | `number \| string` | `0` | Forwarded as SearXNG `safesearch` (`0` off, `1` moderate, `2` strict). |
| `search.categories` | `string` | *(unset)* | Forwarded as SearXNG `categories`. Blank values are skipped. |
| `search.engines` | `string` | *(unset)* | Forwarded as SearXNG `engines`. Blank values are skipped. |
| `search.timeRange` | `string` | *(unset)* | Forwarded as SearXNG `time_range` (`day` \| `week` \| `month` \| `year`). Blank values are skipped. |

Every search request also sends `q` (the query) and `format=json`.

## Single instance

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://192.168.10.100:8080'
    timeoutMs: 15000
    fetchTimeoutMs: 30000
    fetchMaxChars: 200000
    ssrfGuard: true
    search:
      language: 'en'
      safesearch: 0
      # categories: 'general'
      # engines: 'google,bing,ddg'
      # timeRange: 'week'
```

## Triple-stack endpoints with sticky failover

```yaml
- id: searxng-web
  config:
    baseUrls:
      - 'http://203.0.113.10:8081/s/<KEY>'      # public IPv4
      - 'http://[2409:8a55::1]:8081/s/<KEY>'    # public IPv6
      - 'http://192.168.10.144:8081/s/<KEY>'    # LAN (same door, same key)
    timeoutMs: 15000
```

- Attempts start at the last endpoint that succeeded (sticky) and walk
  the list exactly once per call.
- Only network-level failures (refused / unreachable / timeout / DNS)
  advance to the next endpoint. Any HTTP answer (200, 403, 502, …)
  proves the door is alive and is surfaced as-is.
- All endpoints unreachable → one `network`-classified error.
- Empty `baseUrls` falls back to `baseUrl`.

## Authenticated instance

Credentials ride **only** on requests to your SearXNG instance.
`web_fetch` targets are model-chosen third-party pages and always stay
credential-free.

Header gate:

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://searx.internal:8080'
    headers:
      X-API-Key: 'your-key'
```

Basic-auth reverse proxy (caddy `basic_auth`, nginx `auth_basic`):

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://searx.internal:8080'
    basicAuth:
      username: 'searxng'
      password: 'hunter2'
```

Setting both `basicAuth` and `headers.Authorization` fails at load time:

```text
[searxng-web] configuration conflict: basicAuth sets Authorization but headers already defines one; keep only one mechanism
```

Path-prefix key (no plugin config needed): if the proxy strips a secret
prefix, put it in the base URL — the adapter appends `/search?...` to
whatever base you give it:

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://host:8081/s/<KEY>'
```

> Node's `fetch` refuses URLs with embedded credentials
> (`http://user:pass@…`); that is why auth lives in dedicated fields.

## Patch semantics

Rows replace `config` wholesale (no deep merge): when overriding one
key in your profile layer, restate every key you want to keep. The user
layer applies after bundle layers (last write wins per row).
