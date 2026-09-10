# 配置说明文档

[English](CONFIG.md) | 中文

所有配置项位于 `cordis.patch.yml`（profile、home 或 `--patch`
覆盖层）的 `searxng-web` 行上，由 `src/index.ts` 中的 Schemastery
`Config` schema 在加载时校验。以下默认值与 schema 及 `apply()`
中的防御性回退逐字节一致。

## 完整配置表

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `baseUrl` | `string` | `'http://127.0.0.1:8080'` | 单个 SearXNG 实例地址，末尾斜杠会被去除。 |
| `baseUrls` | `string[]` | *（未设置）* | 有序端点列表，带粘性自动故障转移；非空时优先于 `baseUrl`，条目会被去空格并去重。 |
| `timeoutMs` | `number` | `15000` | 单次搜索尝试预算（毫秒），非正数回退到 `15000`。 |
| `fetchTimeoutMs` | `number` | `30000` | 单次抓取尝试预算（毫秒），非正数回退到 `30000`。 |
| `fetchMaxChars` | `number` | `200000` | `web_fetch` 返回字符上限，非正数回退到 `200000`。 |
| `ssrfGuard` | `boolean` | `true` | 拒绝私网/回环/链路本地/CGNAT 的 `web_fetch` 目标，仅在封闭部署中设为 `false`。 |
| `headers` | `Record<string, string>` | *（未设置）* | 仅附加到 **SearXNG 请求** 的额外请求头（如 `X-API-Key`），绝不发送给 `web_fetch` 目标；非字符串值会被忽略。 |
| `basicAuth.username` | `string` | *（未设置）* | 实例位于带认证反向代理后时的 Basic 认证用户名。 |
| `basicAuth.password` | `string` | *（未设置）* | 实例位于带认证反向代理后时的 Basic 认证密码。 |
| `search.language` | `string` | *（未设置）* | 转发为 SearXNG `language` 参数，空值会被跳过。 |
| `search.safesearch` | `number \| string` | `0` | 转发为 SearXNG `safesearch` 参数（`0` 关闭、`1` 中等、`2` 严格）。 |
| `search.categories` | `string` | *（未设置）* | 转发为 SearXNG `categories` 参数，空值会被跳过。 |
| `search.engines` | `string` | *（未设置）* | 转发为 SearXNG `engines` 参数，空值会被跳过。 |
| `search.timeRange` | `string` | *（未设置）* | 转发为 SearXNG `time_range` 参数（`day` \| `week` \| `month` \| `year`），空值会被跳过。 |

每次搜索请求还会发送 `q`（查询词）与 `format=json`。

## 单实例

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://192.168.10.100:8080'
    timeoutMs: 15000
    fetchTimeoutMs: 30000
    fetchMaxChars: 200000
    ssrfGuard: true
    search:
      language: 'zh-CN'
      safesearch: 0
      # categories: 'general'
      # engines: 'google,bing,ddg'
      # timeRange: 'week'
```

## 三栈端点与粘性故障转移

```yaml
- id: searxng-web
  config:
    baseUrls:
      - 'http://203.0.113.10:8081/s/<KEY>'      # 公网 IPv4
      - 'http://[2409:8a55::1]:8081/s/<KEY>'    # 公网 IPv6
      - 'http://192.168.10.144:8081/s/<KEY>'    # 局域网（同一扇门，同一把钥匙）
    timeoutMs: 15000
```

- 每次尝试都从上次成功的端点开始（粘性），每次调用最多完整走一遍列表。
- 只有网络层失败（连接拒绝 / 不可达 / 超时 / DNS）才会换下一个端点；只要某个端点给出 HTTP 应答（200、403、502……），即证明它是活的，状态原样透出。
- 全部端点不可达时抛出一个 `network` 分类错误。
- `baseUrls` 为空时回退到 `baseUrl`。

## 带认证的实例

凭据**只**附加到发往你 SearXNG 实例的请求上。`web_fetch`
目标页由模型任选（第三方页面），永远不带凭据。

Header 门：

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://searx.internal:8080'
    headers:
      X-API-Key: 'your-key'
```

Basic 认证反向代理（caddy `basic_auth`、nginx `auth_basic`）：

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://searx.internal:8080'
    basicAuth:
      username: 'searxng'
      password: 'hunter2'
```

同时设置 `basicAuth` 与 `headers.Authorization` 会在加载时直接报错：

```text
[searxng-web] configuration conflict: basicAuth sets Authorization but headers already defines one; keep only one mechanism
```

路径前缀密钥（零插件配置）：如果反向代理在转发前剥掉一段秘密前缀，直接把它写进 base URL——适配器会在你给的 base 后面追加 `/search?...`，天然兼容：

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://host:8081/s/<KEY>'
```

> Node 的 `fetch` 拒绝内嵌凭据的 URL（`http://user:pass@…`），这就是认证放在独立配置字段而不是塞进 `baseUrl` 的原因。

## 补丁语义

补丁行对 `config` 是整体替换（非深合并）：在 profile 层覆盖某个键时，请把想保留的键一并写全。用户层晚于 bundle 层生效（按行取最后一次写入）。
