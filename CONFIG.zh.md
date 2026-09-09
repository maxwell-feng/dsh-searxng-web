# 配置说明文档 (Configuration Guide)

[English](CONFIG.md) | 简体中文

本文档介绍 `dsh-searxng-web` 插件的所有配置参数、类型定义、默认值与高级场景示例。

---

## 1. 完整配置字段列表

所有配置项均由 `@deepseek-ai/schemastery` 在加载时严格校验。

| 配置字段 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | `"http://127.0.0.1:8080"` | 你的 SearXNG 实例根地址（需已启用 `format=json` 输出支持）。 |
| `timeoutMs` | `number` | `15000` | 搜索与页面抓取请求的单次 HTTP 超时时间（毫秒）。 |
| `maxResults` | `number` | `10` | 默认单次返回的最大搜索结果条数上限（最大支持 50 条）。 |
| `ssrfGuard` | `boolean` | `true` | 是否启用内置 SSRF 防护（阻止模型抓取私有 IP、本地回环和链路本地地址）。封闭内网部署可设为 `false`。 |
| `defaults` | `object` | `{}` | 转发给 SearXNG 的默认参数（语言、安全搜索等）。 |
| `defaults.language` | `string` | `"all"` | 默认搜索语言代码，例如 `"zh"`, `"en"`, `"zh-CN"`。 |
| `defaults.safesearch`| `number \| string` | `0` | 安全过滤等级：`0`（关闭）、`1`（温和）、`2`（严格）。 |
| `defaults.categories`| `string` | `undefined` | 默认限定的搜索分类，例如 `"general"`, `"it"`, `"science"`。 |
| `defaults.engines` | `string` | `undefined` | 默认限定的搜索引擎列表，逗号分隔，如 `"google,bing"`。 |
| `defaults.timeRange` | `string` | `undefined` | 默认时间过滤范围：`"day"`, `"week"`, `"month"`, `"year"`。 |
| `basicAuth` | `object` | `undefined` | 若 SearXNG 位于 HTTP Basic Auth 保护后，设置 `username` 与 `password`。 |
| `headers` | `object` | `{}` | 附加在发往 SearXNG 实例请求上的自定义 HTTP 请求头。 |

---

## 2. 典型配置示例 (`cordis.patch.yml`)

在 Profile 的 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中添加配置：

```yaml
- id: searxng-web
  config:
    baseUrl: "http://192.168.10.100:8080"
    timeoutMs: 20000
    maxResults: 15
    ssrfGuard: true
    defaults:
      language: "zh-CN"
      safesearch: 0
      categories: "general"
```

---

## 3. 安全与隔离提示

- `basicAuth` 与 `headers` 仅会附加到发往 `baseUrl`（即你自建的 SearXNG 服务）的请求中。
- 在 `web_fetch` 获取第三方目标页面时，绝不会泄露任何已配置的认证信息。
