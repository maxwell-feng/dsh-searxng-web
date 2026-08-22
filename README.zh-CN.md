# @maxwell-feng/dsh-searxng-web

[English](README.md) | 简体中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件:让**原生 `web_search` / `web_fetch` 工具**直接走你自托管的 [SearXNG](https://docs.searxng.org) 实例——免 API Key、数据不出内网、不依赖任何第三方搜索服务商。

```
模型 ── web_search ──▶ ctx.web ──▶ searxng-web provider ──▶ 你的 SearXNG ──▶ 各搜索引擎
模型 ── web_fetch ──▶ ctx.web ──▶ searxng-web-fetch ──▶ 目标页面(带 SSRF 防护)
```

## 为什么需要

- dsh 自带的 `web_search` 走 DeepSeek 云端搜索,且默认不挂载任何 fetch provider。即使你部署了 SearXNG,搜索流量仍然会发给第三方——装上这个 bundle 才真正闭环。
- 相比 MCP server 方案,本插件走 dsh 原生 provider 缝隙:模型继续使用短的原生工具名(`web_search` / `web_fetch`),所有 agent 与 subagent 自动继承,dsh 进程外无需常驻任何额外组件。

## 环境要求

- Node.js ≥ 20
- 一个可访问、且已开启 JSON 输出的 SearXNG 实例(`settings.yml` → `search.formats: [html, json]`),用下面的命令验证:

  ```sh
  curl 'http://你的SEARXNG:8080/search?q=test&format=json'
  ```

## 安装

```sh
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# 或锁定 commit:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

包内是纯 JavaScript(无构建步骤),不需要 pnpm 构建白名单。

安装时由自带的补丁层完成三件事:

1. 插入 `searxng-web` 插件行;
2. 把 `ctx.web` 指向它的搜索/抓取 provider;
3. 重新启用 `web_fetch`(`tool-web.fetch`)。

然后正常启动:

```sh
dsh --profile web
```

新会话里直接说"搜 xxx"即可,流量全部走你的实例。随时可以检查组合结果:

```sh
dsh --profile web --dump-config | grep -A5 searxng
```

### 指向你的实例

默认 base URL 是 `http://127.0.0.1:8080`,在 profile 的 `cordis.patch.yml`(用户层,晚于 bundle 层生效)中覆盖:

```yaml
- id: searxng-web
  config:
    baseUrl: 'http://10.42.1.159:8080'
    timeoutMs: 15000        # 单次搜索预算,毫秒
    fetchTimeoutMs: 30000   # 单次网页读取预算,毫秒
    fetchMaxChars: 200000   # web_fetch 返回字符上限
    ssrfGuard: true         # 拒绝私网/回环抓取目标
    search:                 # 每次搜索转发给 SearXNG 的默认参数(均可选)
      language: ''          # 如 'zh-CN'、'en'
      safesearch: 0         # 0 关闭,1 中等,2 严格
      # categories: 'general'   # 'news'、'it,science' 等
      # engines: ''             # 'google,bing,ddg' 等
      # timeRange: ''           # 'day' | 'week' | 'month' | 'year'
```

注意:patch 行对 config 是整体替换(非深合并),覆盖时请把想保留的键一并写全。

## 配置参考

| 键 | 默认值 | 说明 |
|---|---|---|
| `baseUrl` | `http://127.0.0.1:8080` | SearXNG 实例地址 |
| `timeoutMs` | `15000` | 单次搜索尝试预算(毫秒) |
| `fetchTimeoutMs` | `30000` | 单次网页读取预算(毫秒) |
| `fetchMaxChars` | `200000` | `web_fetch` 返回内容字符上限 |
| `ssrfGuard` | `true` | 拒绝私网/回环/链路本地/CGNAT 抓取目标 |
| `search.language` | *(未设置)* | SearXNG `language` 参数 |
| `search.safesearch` | `0` | SearXNG `safesearch` 参数 |
| `search.categories` | *(未设置)* | SearXNG `categories` 参数 |
| `search.engines` | *(未设置)* | SearXNG `engines` 参数 |
| `search.timeRange` | *(未设置)* | SearXNG `time_range` 参数 |

## 行为说明与限制

- **搜索**:SearXNG 结果映射为 `{url, title?, snippet?, publishedAt?}`,若实例返回 `answer` 字段会一并透出。
- **网页读取**:带浏览器 UA 发起 GET;HTML 会清洗为可读文本(script/style 剔除、标签去除、实体解码);超过 `fetchMaxChars` 截断并置 `truncated`。
- **SSRF 防护**:仅校验初始目标 URL——重定向后的地址不再二次校验(v1 已知限制);同时拒绝非 http(s) 协议与无法解析的主机。仅建议在内网封闭环境关闭。
- **代理**:使用 Node 全局 `fetch`,默认忽略系统代理与代理环境变量——到 SearXNG 的流量始终直连。
- **SearXNG 返回 403**:说明实例未开启 JSON 输出,见上文环境要求。

## 卸载

```sh
dsh plugin --profile web remove @maxwell-feng/dsh-searxng-web
```

会同时移除依赖与 bundle 层,`ctx.web` 回落到基础组合(DeepSeek 搜索、无 fetch provider)。

## 许可证

[MIT](LICENSE)
