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
- 已安装 DeepSeek Harness `dsh`(在 `0.1.1-rc.2` 上验证)
- 一个可访问、且已开启 JSON 输出的 SearXNG 实例(`settings.yml` → `search.formats: [html, json]`),用下面的命令验证:

  ```sh
  curl 'http://你的SEARXNG:8080/search?q=test&format=json'
  ```

## 安装

### 从 npm 安装(推荐)

```sh
dsh plugin --profile web add @maxwell-feng/dsh-searxng-web
```

(把 `web` 换成你的 profile,如 `tui`。)CI 发布,带 Sigstore provenance;包内自带预编译的 `lib/`,安装时**无需任何构建**,也不需要 pnpm `allowBuilds` 授权。

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# 或锁定 commit:
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

仓库直接提交了编译好的 `lib/`,git 安装同样无需构建步骤或构建授权。

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

## 从 MCP 版 SearXNG 集成迁移

如果你之前是通过 MCP server 接的 SearXNG(比如经 `dsh-mcp-client` 挂载
[`mcp-searxng`](https://github.com/ihor-sokoliuk/mcp-searxng)),装本插件后建议移除旧接入:

- 否则模型会同时看到**两套重叠的搜索工具**(原生 `web_search` 和
  `mcp__searxng__searxng_web_search`),外加一堆额外 schema——工具选择有随机性,
  每个请求多付约 1–2k token,而搜索质量毫无增益(两者打的是同一个实例)。
- 移除方法:删掉 profile `cordis.patch.yml` 里 `dsh-mcp-client` 的 insert 行
  (HMR 会立即注销工具),再顺手 `npm uninstall -g mcp-searxng`。

放弃的部分:MCP reader 的 PDF 抽取与章节过滤。原生 `web_fetch` 覆盖普通
HTML/文本页面;以后真需要读 PDF,把 MCP 行加回来也只需几分钟。

## 卸载

```sh
dsh plugin --profile web remove @maxwell-feng/dsh-searxng-web
```

会同时移除依赖与 bundle 层,`ctx.web` 回落到基础组合(DeepSeek 搜索、无 fetch provider)。

## 本地开发

插件源码为 TypeScript(`src/index.ts`);编译产物 `lib/index.js` 直接提交在仓库里,安装方永远不需要构建。

```sh
npm install          # 开发依赖(typescript、@types/node、cordis 类型)
npm run build        # 编译 src/ → lib/
npm test             # 构建 + 全离线自包含测试(mock SearXNG)
```

## 发版流程(维护者)

更新 `package.json` 的 `version` 和 `CHANGELOG.md`,然后:

```sh
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

GitHub Actions 会先跑测试套件,再通过 OIDC trusted publishing(Sigstore provenance)发布到 npm——与 [`@maxwell-feng/dsh-windows-ocr`](https://github.com/maxwell-feng/dsh-windows-ocr) 同一条流水线。

## 许可证

[MIT](LICENSE)
