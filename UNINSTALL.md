# Uninstall Guide

English | [中文](UNINSTALL.zh.md)

This document explains how to completely uninstall `dsh-searxng-web` from your DeepSeek Harness profiles.

---

## 1. Remove the Plugin Bundle

```bash
dsh plugin --profile web remove dsh-searxng-web
```

This uninstalls the npm dependency from the profile and purges the bundle layer (the `searxng-web` plugin row, the `ctx.web` provider pointers, and the `tool-web` re-enable row).

---

## 2. Clean Up Custom Config (Optional)

Remove the patch row from `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
# Remove this block
- id: searxng-web
  config:
    ...
```

---

## 3. Verification

```bash
dsh --profile web --dump-config | grep -A5 searxng
```

Start `dsh --profile web` and verify search falls back to the base
composition (DeepSeek search, no fetch provider) without errors.
