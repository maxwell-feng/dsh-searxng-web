// Standalone smoke test for @maxwell-feng/dsh-searxng-web.
//
// Fully self-contained like the dsh-windows-ocr suite: a mock SearXNG
// instance and a mock page server are started in-process, so no LAN
// instance or external site is needed — safe to run in CI.

import http from "node:http";
import { once } from "node:events";
import { apply } from "../index.js";

/** Minimal JSON-RPC-free helper: start an http server, return its base URL. */
async function startServer(handler) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

function makeCtx() {
  const providers = { search: [], fetch: [] };
  return {
    providers,
    web: {
      registerSearchProvider: (p) => providers.search.push(p),
      registerFetchProvider: (p) => providers.fetch.push(p),
    },
    logger: { info: () => {} },
  };
}

let failures = 0;
function check(label, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok" : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`);
}

// ---- mock SearXNG instance --------------------------------------------------
const searx = await startServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/search" && url.searchParams.get("format") === "json") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      answer: "SearXNG is a metasearch engine.",
      results: [
        { url: "https://docs.searxng.org/", title: "SearXNG Docs", content: "Administrator documentation.", publishedDate: "2026-01-01" },
        { url: "", title: "dropped: no url" },
        { url: "https://github.com/searxng/searxng", title: "searxng/searxng", content: "Source code." },
      ],
    }));
    return;
  }
  res.statusCode = 403;
  res.end("forbidden");
});

// ---- mock target page --------------------------------------------------------
const page = await startServer((req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end("<html><head><style>body{color:red}</style></head><body><h1>Hello &amp; welcome</h1><script>alert(1)</script><p>First paragraph.</p></body></html>");
});

try {
  // Guard off so the success-path fetch may target the loopback mock.
  const ctx = makeCtx();
  apply(ctx, { baseUrl: searx.base, ssrfGuard: false });
  const sp = ctx.providers.search[0];
  const fp = ctx.providers.fetch[0];

  check("search provider available", sp.available() === true);
  check("fetch provider available", fp.available() === true);

  // 1) search maps sources, drops url-less rows, surfaces answer
  const out = await sp.search({ query: "searxng", maxResults: 5 }, undefined);
  check("search returns mapped sources", out.sources.length === 2, `${out.sources.length}`);
  check("search keeps title/snippet", out.sources[0]?.title === "SearXNG Docs" && out.sources[0]?.snippet === "Administrator documentation.");
  check("search maps publishedAt", out.sources[0]?.publishedAt === "2026-01-01");
  check("search surfaces SearXNG answer", out.content === "SearXNG is a metasearch engine.");

  // 2) search forwards configured defaults (language reaches the mock)
  const ctxWithDefaults = makeCtx();
  apply(ctxWithDefaults, { baseUrl: searx.base, ssrfGuard: false, search: { language: "zh-CN" } });
  let sawLanguage = false;
  searx.server.once("request", (req) => { sawLanguage = new URL(req.url, "http://x").searchParams.get("language") === "zh-CN"; });
  await ctxWithDefaults.providers.search[0].search({ query: "x" }, undefined);
  check("search forwards language default", sawLanguage);

  // 3) fetch strips html down to text
  const pageRes = await fp.fetch({ url: `${page.base}/doc` }, undefined);
  check("fetch status 200", pageRes.statusCode === 200);
  check("fetch body kind text", pageRes.body.kind === "text");
  const content = pageRes.body.content;
  check("fetch strips tags/scripts/styles", !/<|alert\(1\)|body\{/.test(content), JSON.stringify(content.slice(0, 60)));
  check("fetch decodes entities", content.includes("Hello & welcome"));

  // 4) SSRF guard refuses private/loopback targets when enabled
  const guardedCtx = makeCtx();
  apply(guardedCtx, { baseUrl: searx.base, ssrfGuard: true });
  try {
    await guardedCtx.providers.fetch[0].fetch({ url: "http://127.0.0.1:1/x" }, undefined);
    check("SSRF guard refuses loopback", false, "no error thrown");
  } catch (e) {
    check("SSRF guard refuses loopback", /SSRF guard/.test(e.message));
  }
  try {
    await guardedCtx.providers.fetch[0].fetch({ url: "ftp://example.com/x" }, undefined);
    check("SSRF guard refuses non-http(s)", false, "no error thrown");
  } catch (e) {
    check("SSRF guard refuses non-http(s)", /unsupported protocol/.test(e.message));
  }

  // 5) caller abort propagates untouched
  const ac = new AbortController();
  ac.abort();
  try {
    await sp.search({ query: "x" }, ac.signal);
    check("caller abort propagates", false, "no error");
  } catch (e) {
    check("caller abort propagates", e.name === "AbortError" || e.code === "aborted");
  }

  // 6) empty inputs are rejected as bad requests
  try {
    await sp.search({ query: "  " }, undefined);
    check("empty query rejected", false, "no error");
  } catch (e) {
    check("empty query rejected", e.code === "bad-request");
  }
} finally {
  searx.server.close();
  page.server.close();
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
