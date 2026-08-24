// Standalone smoke test for @maxwell-feng/dsh-searxng-web.
//
// Fully self-contained like the dsh-windows-ocr suite: a mock SearXNG
// instance and a mock page server are started in-process, so no LAN
// instance or external site is needed — safe to run in CI.

import http from "node:http";
import { once } from "node:events";
import { apply } from "../lib/index.js";

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

  // 7) instance credentials ride on SearXNG requests only
  const gated = await startServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/search" && url.searchParams.get("format") === "json") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        results: [{
          url: "https://example.com/echoed",
          title: String(req.headers["x-api-key"] ?? ""),
          content: String(req.headers["authorization"] ?? ""),
        }],
      }));
      return;
    }
    res.statusCode = 500;
    res.end();
  });
  try {
    const gctx = makeCtx();
    apply(gctx, {
      baseUrl: gated.base,
      ssrfGuard: false,
      headers: { "X-API-Key": "secret-key" },
      basicAuth: { username: "searxng", password: "hunter2" },
    });
    const out7 = await gctx.providers.search[0].search({ query: "q" }, undefined);
    check("headers passthrough reaches SearXNG (X-API-Key)", out7.sources[0]?.title === "secret-key");
    let decoded = "";
    if (/^Basic /.test(out7.sources[0]?.snippet ?? "")) {
      decoded = Buffer.from(out7.sources[0].snippet.slice(6), "base64").toString();
    }
    check("basicAuth sets Authorization Basic user:pass", decoded === "searxng:hunter2");

    // web_fetch targets are model-chosen pages and must stay credential-free
    let pageCreds;
    page.server.on("request", (req) => { pageCreds = [req.headers.authorization, req.headers["x-api-key"]]; });
    await gctx.providers.fetch[0].fetch({ url: `${page.base}/leak-test` }, undefined);
    check("web_fetch targets stay credential-free", !pageCreds?.[0] && !pageCreds?.[1], JSON.stringify(pageCreds));

    // a user-supplied Authorization alongside basicAuth fails loudly at load
    try {
      apply(makeCtx(), { baseUrl: gated.base, basicAuth: { password: "p" }, headers: { Authorization: "Bearer x" } });
      check("basicAuth vs headers conflict rejected", false, "no error");
    } catch (e) {
      check("basicAuth vs headers conflict rejected", /conflict/.test(e.message));
    }
  } finally {
    gated.server.close();
  }
} finally {
  searx.server.close();
  page.server.close();
}

// ---- multi-endpoint sticky failover (v0.4.0) ---------------------------------
// A closed loopback port yields instant ECONNREFUSED, standing in for an
// unreachable door without any wall-clock timeout cost.
async function makeSearx(answer) {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/search" && url.searchParams.get("format") === "json") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ answer, results: [{ url: "https://example.com/x", title: answer }] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, base: `http://127.0.0.1:${server.address().port}`, get hits() { return hits; } };
}

const deadServer = http.createServer(() => {});
deadServer.listen(0, "127.0.0.1");
await once(deadServer, "listening");
const deadBase = `http://127.0.0.1:${deadServer.address().port}`;
deadServer.close();
await once(deadServer, "close");

try {
  // T1: a network-level failure on the first endpoint falls over to the next.
  const instB = await makeSearx("from-B");
  try {
    const ctxA = makeCtx();
    apply(ctxA, { baseUrls: [deadBase, instB.base], ssrfGuard: false });
    const outT1 = await ctxA.providers.search[0].search({ query: "q" }, undefined);
    check("failover skips unreachable endpoint", outT1.content === "from-B", String(outT1.content));

    // T2: stickiness — after one failover the winner stays primary for later
    // calls (no round-robin), and is skipped transparently when it dies.
    const instC = await makeSearx("from-C");
    try {
      const ctxS = makeCtx();
      apply(ctxS, { baseUrls: [deadBase, instC.base, instB.base], ssrfGuard: false });
      const spS = ctxS.providers.search[0];
      const bBaseline = instB.hits; // T1 may have pinged B; only the DELTA matters
      const r1 = await spS.search({ query: "q" }, undefined);
      const r2 = await spS.search({ query: "q" }, undefined);
      check(
        "sticky keeps last-good endpoint",
        r1.content === "from-C" && r2.content === "from-C" && instB.hits === bBaseline,
        `r1=${r1.content} r2=${r2.content} B-delta=${instB.hits - bBaseline}`,
      );
      instC.server.close();
      await once(instC.server, "close");
      const r3 = await spS.search({ query: "q" }, undefined);
      check("fails over again when sticky endpoint dies", r3.content === "from-B", String(r3.content));
    } finally {
      if (instC.server.listening) instC.server.close();
    }

    // T4: empty baseUrls falls back to the classic single baseUrl.
    const ctxE = makeCtx();
    apply(ctxE, { baseUrls: [], baseUrl: instB.base, ssrfGuard: false });
    const outT4 = await ctxE.providers.search[0].search({ query: "q" }, undefined);
    check("empty baseUrls falls back to baseUrl", outT4.content === "from-B", String(outT4.content));
  } finally {
    instB.server.close();
  }

  // T3: when every endpoint is unreachable the error stays network-classified.
  const ctxD = makeCtx();
  apply(ctxD, { baseUrls: [deadBase, deadBase], ssrfGuard: false });
  try {
    await ctxD.providers.search[0].search({ query: "q" }, undefined);
    check("all-endpoints-dead surfaces network error", false, "no error");
  } catch (e) {
    check("all-endpoints-dead surfaces network error", e.code === "network");
  }
} catch (err) {
  failures++;
  console.log(`FAIL - failover suite crashed: ${err?.message ?? err}`);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
