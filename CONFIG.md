# Configuration Guide

English | [简体中文](CONFIG.zh.md)

This document describes all configuration options, type contracts, defaults, and usage examples for `dsh-searxng-web`.

---

## 1. Full Configuration Options

All options are validated at load time by `@deepseek-ai/schemastery`.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | `"http://127.0.0.1:8080"` | Endpoint of your SearXNG instance (with JSON format enabled). |
| `timeoutMs` | `number` | `15000` | HTTP request timeout in milliseconds for search and fetch operations. |
| `maxResults` | `number` | `10` | Maximum number of search results returned per query (capped at 50). |
| `ssrfGuard` | `boolean` | `true` | Refuse private/loopback/link-local destinations during `web_fetch`. Set `false` only in closed networks. |
| `defaults` | `object` | `{}` | Query defaults passed directly to SearXNG. |
| `defaults.language` | `string` | `"all"` | Language code, e.g. `"en"`, `"zh-CN"`. |
| `defaults.safesearch`| `number / string` | `0` | Safe search filter level: `0` (off), `1` (moderate), `2` (strict). |
| `defaults.categories`| `string` | `undefined` | Restrict search categories, e.g. `"general"`, `"it"`. |
| `defaults.engines` | `string` | `undefined` | Comma-separated search engine names, e.g. `"google,bing"`. |
| `defaults.timeRange` | `string` | `undefined` | Time filter: `"day"`, `"week"`, `"month"`, `"year"`. |
| `basicAuth` | `object` | `undefined` | `username` and `password` for instances behind HTTP Basic Authentication. |
| `headers` | `object` | `{}` | Custom HTTP headers sent to the SearXNG instance. |

---

## 2. Configuration Example (`cordis.patch.yml`)

Add to `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: searxng-web
  config:
    baseUrl: "http://192.168.10.100:8080"
    timeoutMs: 20000
    maxResults: 15
    ssrfGuard: true
    defaults:
      language: "en"
      safesearch: 0
      categories: "general"
```
