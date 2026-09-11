# Update Guide

English | [中文](UPDATE.zh.md)

> Verified against DeepSeek Harness **0.1.5-rc.2**.

This document outlines how to upgrade `dsh-searxng-web` to the latest release and verify compatibility.

---

## 1. Upgrade Instructions

### Upgrading via npm
```bash
dsh plugin --profile web update dsh-searxng-web@latest
```
or pin version:
```bash
dsh plugin --profile web add dsh-searxng-web@0.9.0
```

### Upgrading via Git Checkout
```bash
cd /path/to/dsh-searxng-web
git pull origin master
npm run build
```
or refresh via GitHub link:
```bash
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
```

### Upgrading via Tarball
```bash
dsh plugin --profile web add ./dsh-searxng-web-0.9.0.tgz
```

---

## 2. Version Notes

- **0.9.0** refactors the plugin codebase into modular TypeScript components
  (`types.ts`, `config.ts`, `ssrf.ts`, `html.ts`, `http.ts`, `search-provider.ts`,
  `fetch-provider.ts`, `index.ts`), strictly following the official harness plugin
  development guidelines.
- **0.8.0** targets harness `0.1.5-rc.2`, adds `manifestVersion: 1` under
  `package.json.dsh` conforming to `@deepseek-ai/dsh-package-manifest`,
  and declares host requirement `"dsh": "^0.1.5-rc.2"`.
- **0.7.0** targets harness `0.1.5-rc.1` and raises the Node floor to
  `>=22`. No config changes required: every field keeps its default,
  and single-`baseUrl` setups are unaffected. Since 0.3.0 configuration
  is validated at load time (Schemastery schema) — a mistyped key fails
  the boot with an actionable error instead of being silently ignored.
- **0.4.0** added the optional `baseUrls` sticky-failover list;
  single-`baseUrl` setups are unaffected.

---

## 3. Verification and Rollback

Launch the profile:
```bash
dsh --profile web --dump-config | grep -A5 searxng
dsh --profile web
```
Ask a live question requiring search/fetch. Confirm results are returned from your SearXNG instance.

To roll back:
```bash
dsh plugin --profile web add dsh-searxng-web@0.6.0
```
