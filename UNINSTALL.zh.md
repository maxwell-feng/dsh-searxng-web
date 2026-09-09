# 卸载说明文档 (Uninstall Guide)

[English](UNINSTALL.md) | 简体中文

本文档指导如何从 DeepSeek Harness 的指定 Profile 中完整卸载 **dsh-searxng-web** 插件及其自定义配置。

---

## 1. 移除插件包 (Bundle)

```bash
dsh plugin --profile web remove dsh-searxng-web
```

该命令将从目标 profile 依赖与激活组合层列表中彻底注销该插件。

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

启动 DeepSeek Harness：
```bash
dsh web
```
`web_search` 将自动恢复使用官方或基础的搜索后端。
