# 安装说明文档

[English](INSTALL.md) | 中文

## 环境要求

- Node.js `>=22`（harness 的底线是 `^22.19.0 || >=24.0.0`）
- DeepSeek Harness `dsh`，版本 `0.1.5-rc.2`
- 一个可访问、且已开启 JSON 输出的 SearXNG 实例（`settings.yml` → `search.formats: [html, json]`），用下面的命令验证：

```sh
curl 'http://你的SEARXNG:8080/search?q=test&format=json'
```

## 从 npm 安装（推荐）

`dsh plugin --profile <name> <args...>` 会转发给该 profile 目录下的
pnpm，因此所有 pnpm 动词都可用。首次使用会初始化该 profile（以
`@deepseek-ai/dsh-base` 作为第一个 bundle）：

```sh
dsh plugin --profile web add dsh-searxng-web
```

把 `web` 换成你的 profile（如 `tui`）。CI 发布，带 Sigstore
provenance；包内自带预编译的 `lib/`，安装时无需任何构建。

## 从源码目录安装

```sh
dsh plugin --profile web add ./dsh-searxng-web
```

## 从 tarball 安装

```sh
dsh plugin --profile web add ./dsh-searxng-web-1.0.0.tgz
```

## 从 git 安装

```sh
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web
# 或锁定 commit：
dsh plugin --profile web add github:maxwell-feng/dsh-searxng-web#<sha>
```

Git 安装拿到的是源码：仓库直接提交了编译好的 `lib/` 产物，`prepare`
脚本（`npm run build`）会在安装后从源码重新构建。pnpm 在明确授权前
拒绝执行 git 依赖的 `prepare` 脚本——如果首次 `add` 失败，`dsh`
会指出修复方法：把 pnpm 打印出的包键原样复制到该 profile 的
`pnpm-workspace.yaml` 中，再重新执行 `add`。

## 安装时发生了什么

bundle 清单（`dsh.bundle.patch: ./cordis.patch.yml`）贡献一个配置层。安装会把该
bundle 追加到 profile 的 `dsh.profile.bundles` 列表中，各层按列表顺序组合
（先 `@deepseek-ai/dsh-base`，再依次是每个已安装的 bundle），之后依次是
profile 自身的 `cordis.patch.yml`、home 级别的
`$DSH_HOME/cordis.patch.yml`，以及所有 `--patch` 覆盖层。本 bundle 的层做三件事：

1. 插入 `searxng-web` 插件行；
2. 把 `ctx.web` 指向它的搜索/抓取 provider（`searchProvider: searxng-web`、`fetchProvider: searxng-web-fetch`）；
3. 重新启用原生工具（`tool-web`：`disabled: false`、`search: true`、`fetch: true`）。

## 验证

```sh
dsh --profile web --dump-config | grep -A5 searxng
dsh --profile web
```

然后在会话里调用 `web_search "test"`，检查 `sources[].url`。GUI 的**设置 → 网页搜索**页面会显示 provider 就绪状态。

下一步：[配置说明文档](CONFIG.zh.md) · [使用说明文档](USAGE.zh.md)
