# Uninstall Guide

English | [简体中文](UNINSTALL.zh.md)

This document explains how to completely uninstall `dsh-searxng-web` from your DeepSeek Harness profiles.

---

## 1. Remove the Plugin Bundle

```bash
dsh plugin --profile web remove dsh-searxng-web
```

This uninstalls the npm dependency from the profile and purges the bundle layer.

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

Start `dsh web` and verify search defaults to the built-in provider without errors.
