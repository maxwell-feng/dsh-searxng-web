# 更新说明文档 (Update Guide)

[English](UPDATE.md) | 简体中文

> 本版本已在 DeepSeek Harness **0.1.5-alpha.1** 最新发布版本上全面验证。

本文档介绍如何将 **dsh-searxng-web** 插件升级至最新版本。

---

## 1. 升级指令

### 从 npm 升级
```bash
dsh plugin --profile web update dsh-searxng-web@latest
```

或安装指定版本：
```bash
dsh plugin --profile web add dsh-searxng-web@0.6.0
```

### 从 Git 仓库升级
```bash
cd /path/to/dsh-searxng-web
git pull origin main
npm run build
```

或更新 profile 引用：
```bash
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
```

### 从 Tarball 离线包升级
```bash
dsh plugin --profile web add ./dsh-searxng-web-0.6.0.tgz
```

---

## 2. 验证与回滚

启动服务并验证：
```bash
dsh web
```
在会话中让模型执行联网搜索或抓取网页，确认 SearXNG 实例产生对应查询访问日志。

若需回滚至上一版本：
```bash
dsh plugin --profile web add dsh-searxng-web@0.5.9
```
