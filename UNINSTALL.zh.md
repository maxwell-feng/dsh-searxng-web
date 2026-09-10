# 卸载说明文档

[English](UNINSTALL.md) | 中文

本文档指导如何从 DeepSeek Harness 的指定 Profile 中完整卸载 **dsh-searxng-web** 插件及其自定义配置。

---

## 1. 移除插件包 (Bundle)

```bash
dsh plugin --profile web remove dsh-searxng-web
```

该命令将从目标 profile 移除 npm 依赖并清除 bundle 层（`searxng-web` 插件行、`ctx.web` provider 指向、`tool-web` 重启用行）。

---

## 2. 清理自定义配置 (可选)

如果你曾在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中添加过覆盖项，请移除对应的条目：

```yaml
# 移除此配置块
- id: searxng-web
  config:
    ...
```

---

## 3. 验证卸载

```bash
dsh --profile web --dump-config | grep -A5 searxng
```

启动 `dsh --profile web`，确认 `web_search` 已回落到基础组合（DeepSeek 搜索、无 fetch provider）且无报错。
