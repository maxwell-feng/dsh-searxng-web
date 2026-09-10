# 使用说明文档

[English](USAGE.md) | 中文

模型继续使用短的原生工具名——无需改动任何工具名。安装 bundle 后，
以下两个工具在每个 agent 与 subagent 中自动可用。

## `web_search`——搜索你的 SearXNG 实例

模型侧参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `queries` | `string[]` | 是 | 1–4 个非空查询（会自动去重），单个搜索用只含一项的数组。 |

部署层把这些查询并发打到你的 SearXNG 实例（`GET {base}/search?q=<query>&format=json`，外加[配置文档](CONFIG.zh.md)中的
`search.*` 默认参数），再合并为一份归一化答案：SearXNG 的可选
`answer` 行，外加一个截断后的来源列表。

每个来源保持 provider 映射的形状：

```json
{
  "url": "https://docs.searxng.org/",
  "title": "SearXNG Docs",
  "snippet": "Administrator documentation.",
  "publishedAt": "2026-01-01"
}
```

- `url` 一定存在（没有 url 的行会被丢弃）；`title` / `snippet` / `publishedAt` 只有 SearXNG 返回时才出现。
- SearXNG 返回非空 `answer` 字符串时，会作为结果顶层内容透出。
- provider 单查询上限：`maxResults` 在 50 硬顶以内有效；未设置表示取 SearXNG 返回的全部行。
- 失败会被分类：`bad-request`（空查询）、`auth`（HTTP 403——请开启 JSON 输出或检查凭据）、`server`（HTTP 5xx）、`network`（不可达 / 超时 / DNS；配置 `baseUrls` 时走完粘性故障转移后抛出）。

示例——单个搜索：

```text
你：搜一下 SearXNG 文档里结果排序的说明
模型：[调用 web_search {"queries": ["SearXNG result ranking"]}]
      → 来源：docs.searxng.org/…、github.com/searxng/searxng/…
```

示例——一次调用并发多个查询：

```text
模型：[调用 web_search {"queries": ["SearXNG settings.yml", "SearXNG search.formats json"]}]
      → 两个查询合并后的一份答案与来源列表
```

## `web_fetch`——把页面读成纯文本

模型侧参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | `string` | 是 | 要读取的 `http(s)` 地址，非空。 |

provider 带着浏览器 UA 发起有预算限制的 `GET`，返回重定向后的最终 URL：

```text
Fetched https://example.com/page (HTTP 200)

<页面正文……>

(Content truncated. Fetch a more specific URL or section for the full text.)
```

- HTML 会被清洗为可读文本（剔除 script/style、去掉标签、解码实体）；其他内容类型原样透出。
- 输出上限为 `fetchMaxChars`（默认 200000），超长正文置 `truncated` 标记。
- SSRF 防护（默认开启）拒绝私网/回环/链路本地/CGNAT 目标、非 `http(s)` 协议与无法解析的主机；已知 v1 限制：仅校验初始 URL，重定向后的地址不再二次校验。
- 实例凭据（`headers` / `basicAuth`）绝不附加到抓取目标上。
- 失败会被分类：`bad-request`（空 URL、被拦截的目标）、`auth`（HTTP 401/403）、`server`（HTTP 5xx）、`network`（超时 / 不可达）。

示例：

```text
你：抓取 https://docs.searxng.org/ 并总结部署步骤
模型：[调用 web_fetch {"url": "https://docs.searxng.org/"}]
      → 拿到页面文本后给出总结，并把该 URL 作为 markdown 链接引用
```

## 验证行为

```sh
dsh --profile web --dump-config | grep -A5 searxng
# 或在会话里调用 web_search "test" 检查 sources[].url
```

GUI：**设置 → 网页搜索**显示 provider 就绪状态。

另见：[配置说明文档](CONFIG.zh.md)、[更新说明文档](UPDATE.zh.md)、[卸载说明文档](UNINSTALL.zh.md)。
