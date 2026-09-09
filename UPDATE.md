# Update Guide

English | [简体中文](UPDATE.zh.md)

> Verified against DeepSeek Harness **0.1.5-alpha.1**.

This document outlines how to upgrade `dsh-searxng-web` to the latest release and verify compatibility.

---

## 1. Upgrade Instructions

### Upgrading via npm
```bash
dsh plugin --profile web update dsh-searxng-web@latest
```
or pin version:
```bash
dsh plugin --profile web add dsh-searxng-web@0.6.0
```

### Upgrading via Git Checkout
```bash
cd /path/to/dsh-searxng-web
git pull origin main
npm run build
```
or refresh via GitHub link:
```bash
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
```

### Upgrading via Tarball
```bash
dsh plugin --profile web add ./dsh-searxng-web-0.6.0.tgz
```

---

## 2. Verification and Rollback

Launch the profile:
```bash
dsh web
```
Ask a live question requiring search/fetch. Confirm results are returned from your SearXNG instance.

To roll back:
```bash
dsh plugin --profile web add dsh-searxng-web@0.5.9
```
