# Usage Guide

English | [中文](USAGE.zh.md)

The model keeps using the short native tool names — no tool-name
changes. Both tools below are available in every agent and subagent
once the bundle is installed.

## `web_search` — search your SearXNG instance

Model-facing arguments:

| Param | Type | Required | Description |
|---|---|---|---|
| `queries` | `string[]` | yes | 1–4 non-empty queries (duplicates are removed). Use a one-item array for a single search. |

The deployment runs the queries concurrently against your SearXNG
instance (`GET {base}/search?q=<query>&format=json`, plus any
`search.*` defaults from [Configuration](CONFIG.md)) and merges the
results into one normalized answer: an optional `answer` line from
SearXNG plus a capped list of sources.

Each source keeps the shape mapped by the provider:

```json
{
  "url": "https://docs.searxng.org/",
  "title": "SearXNG Docs",
  "snippet": "Administrator documentation.",
  "publishedAt": "2026-01-01"
}
```

- `url` is always present (rows without one are dropped);
  `title` / `snippet` / `publishedAt` appear only when SearXNG returns them.
- When SearXNG returns an `answer` string it is surfaced as the result's
  top-level content.
- Per-query provider cap: `maxResults` is honored up to a hard ceiling
  of 50; unset means all rows SearXNG returned.
- Failures are classified: `bad-request` (empty query), `auth` (HTTP
  403 — enable JSON output, or check credentials), `server` (HTTP 5xx),
  `network` (unreachable / timeout / DNS, after sticky failover when
  `baseUrls` is configured).

Example — single search:

```text
You: search SearXNG docs for result ranking
Model: [calls web_search {"queries": ["SearXNG result ranking"]}]
       → sources: docs.searxng.org/…, github.com/searxng/searxng/…
```

Example — parallel queries in one call:

```text
Model: [calls web_search {"queries": ["SearXNG settings.yml", "SearXNG search.formats json"]}]
       → one merged answer with sources from both queries
```

## `web_fetch` — read a page as text

Model-facing arguments:

| Param | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes | The `http(s)` URL to read. Must be non-empty. |

The provider performs a bounded `GET` with a browser-ish User-Agent and
returns the final URL after redirects:

```text
Fetched https://example.com/page (HTTP 200)

<page text…>

(Content truncated. Fetch a more specific URL or section for the full text.)
```

- HTML is reduced to readable text (script/style stripped, tags
  removed, entities decoded); other content types pass through as-is.
- Output is capped at `fetchMaxChars` (default 200000); longer bodies
  set the `truncated` flag.
- The SSRF guard (default on) refuses private/loopback/link-local/CGNAT
  targets, non-`http(s)` protocols, and unresolvable hosts — with one
  known v1 limitation: only the initial URL is validated, redirects are
  followed without re-validation.
- Instance credentials (`headers` / `basicAuth`) are never attached to
  fetch targets.
- Failures are classified: `bad-request` (empty URL, blocked target),
  `auth` (HTTP 401/403), `server` (HTTP 5xx), `network` (timeout /
  unreachable).

Example:

```text
You: fetch https://docs.searxng.org/ and summarize the setup steps
Model: [calls web_fetch {"url": "https://docs.searxng.org/"}]
       → page text, then a summary with the URL cited as a markdown link
```

## Verifying behavior

```sh
dsh --profile web --dump-config | grep -A5 searxng
# or inside a session: call web_search "test" and inspect sources[].url
```

GUI: **Settings → Web Search** shows provider readiness.

See also: [Configuration Guide](CONFIG.md) for every knob,
[Update Guide](UPDATE.md), [Uninstall Guide](UNINSTALL.md).
