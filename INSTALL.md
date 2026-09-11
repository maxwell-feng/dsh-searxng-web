# Installation Guide

English | [中文](INSTALL.zh.md)

## Requirements

- Node.js `>=22` (the harness floor is `^22.19.0 || >=24.0.0`)
- DeepSeek Harness `dsh` at `0.1.5-rc.2`
- A reachable SearXNG instance with JSON output enabled
  (`settings.yml` → `search.formats: [html, json]`), verified by:

```sh
curl 'http://YOUR_SEARXNG:8080/search?q=test&format=json'
```

## From npm (recommended)

`dsh plugin --profile <name> <args...>` forwards to pnpm in the
profile directory, so every pnpm verb works. The first use initializes
the profile (with `@deepseek-ai/dsh-base` as its first bundle):

```sh
dsh plugin --profile web add dsh-searxng-web
```

Replace `web` with your profile (e.g. `tui`). Published from CI with
Sigstore provenance; the package ships a prebuilt `lib/`, so nothing
needs to be compiled on install.

## From a source checkout

```sh
dsh plugin --profile web add ./dsh-searxng-web
```

## From a tarball

```sh
dsh plugin --profile web add ./dsh-searxng-web-0.9.0.tgz
```

## From git

```sh
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# or pin a commit:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

Git installs fetch sources: the repository commits the compiled `lib/`
output, and the `prepare` script (`npm run build`) rebuilds it from
source after install. pnpm refuses to run a git dependency's `prepare`
script until it is allowlisted — if the first `add` fails, `dsh` points
at the fix: copy the exact package key pnpm printed into the profile's
`pnpm-workspace.yaml` and re-run the `add`.

## What installing does

The bundle manifest (`dsh.bundle.patch: ./cordis.patch.yml`) contributes
one configuration layer. Installing appends the bundle to the profile's
`dsh.profile.bundles` list, and the layer is composed in list order
(`@deepseek-ai/dsh-base` first, then each installed bundle), followed by
the profile's own `cordis.patch.yml`, the home-level
`$DSH_HOME/cordis.patch.yml`, and any `--patch` overlays. This bundle's
layer does three things:

1. inserts the `searxng-web` plugin row;
2. points `ctx.web` at its search/fetch providers
   (`searchProvider: searxng-web`, `fetchProvider: searxng-web-fetch`);
3. re-enables the native tools (`tool-web`: `disabled: false`,
   `search: true`, `fetch: true`).

## Verify

```sh
dsh --profile web --dump-config | grep -A5 searxng
dsh --profile web
```

Then call `web_search "test"` inside a session and inspect
`sources[].url`. The GUI **Settings → Web Search** page shows provider
readiness.

Next: [Configuration Guide](CONFIG.md) · [Usage Guide](USAGE.md)
