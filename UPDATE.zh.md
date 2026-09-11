# 更新说明文档

[English](UPDATE.md) | 中文

> 本版本已在 DeepSeek Harness **0.1.5-rc.2** 上全面验证。

本文档介绍如何将 **dsh-searxng-web** 插件升级至最新版本。

---

## 1. 升级指令

### 从 npm 升级
```bash
dsh plugin --profile web update dsh-searxng-web@latest
```

或安装指定版本：
```bash
dsh plugin --profile web add dsh-searxng-web@1.0.0
```

### 从 Git 仓库升级
```bash
cd /path/to/dsh-searxng-web
git pull origin master
npm run build
```

或更新 profile 引用：
```bash
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
```

### 从 Tarball 离线包升级
```bash
dsh plugin --profile web add ./dsh-searxng-web-1.0.0.tgz
```

---

## 2. 版本说明

- **1.0.0** 纯 TypeScript 架构（零 JavaScript 残留），测试套件全面迁入纯 TypeScript 并由 Node `--experimental-strip-types` 原生运行，模块化重构为 `types.ts`、`config.ts`、`ssrf.ts`、`html.ts`、`http.ts`、`search-provider.ts`、`fetch-provider.ts`。
- **0.8.0** 适配 harness `0.1.5-rc.2`，遵循最新 `@deepseek-ai/dsh-package-manifest` 规范增加 `manifestVersion: 1` 声明并声明宿主兼容区间 `"dsh": "^0.1.5-rc.2"`。
- **0.7.0** 适配 harness `0.1.5-rc.1`，Node 底线升至 `>=22`。无需改动任何配置：所有字段默认值不变，单 `baseUrl` 用法完全不受影响。从 0.3.0 起配置会在加载时校验（Schemastery schema），写错的键会让启动直接报出可定位的错误，不再被静默忽略。
- **0.4.0** 新增可选的 `baseUrls` 粘性故障转移列表；单 `baseUrl` 用法完全不受影响。

---

## 3. 验证与回滚

启动服务并验证：
```bash
dsh --profile web --dump-config | grep -A5 searxng
dsh --profile web
```
在会话中让模型执行联网搜索或抓取网页，确认 SearXNG 实例产生对应查询访问日志。

若需回滚至上一版本：
```bash
dsh plugin --profile web add dsh-searxng-web@0.6.0
```
