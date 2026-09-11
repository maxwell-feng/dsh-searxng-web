// Standalone test suite for dsh-searxng-web (pure TypeScript).
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { apply } from "../src/index.ts";
import type { PluginContext } from "../src/types.ts";

async function startServer(handler: http.RequestListener) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { server, base: `http://127.0.0.1:${port}` };
}

function makeCtx(): PluginContext & { providers: { search: any[]; fetch: any[] } } {
  const providers = { search: [] as any[], fetch: [] as any[] };
  return {
    providers,
    web: {
      registerSearchProvider: (p: any) => {
        providers.search.push(p);
        return () => {};
      },
      registerFetchProvider: (p: any) => {
        providers.fetch.push(p);
        return () => {};
      },
    },
    logger: { info: () => {} },
  } as any;
}

test("dsh-searxng-web core and failover suite", async (t) => {
  const searx = await startServer((req, res) => {
    const url = new URL(req.url ?? "", "http://x");
    if (url.pathname === "/search" && url.searchParams.get("format") === "json") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          answer: "SearXNG is a metasearch engine.",
          results: [
            {
              url: "https://docs.searxng.org/",
              title: "SearXNG Docs",
              content: "Administrator documentation.",
              publishedDate: "2026-01-01",
            },
            { url: "", title: "dropped: no url" },
            {
              url: "https://github.com/searxng/searxng",
              title: "searxng/searxng",
              content: "Source code.",
            },
          ],
        }),
      );
      return;
    }
    res.statusCode = 403;
    res.end("forbidden");
  });

  const page = await startServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(
      "<html><head><style>body{color:red}</style></head><body><h1>Hello &amp; welcome</h1><script>alert(1)</script><p>First paragraph.</p></body></html>",
    );
  });

  try {
    const ctx = makeCtx();
    apply(ctx, { baseUrl: searx.base, ssrfGuard: false });
    const sp = ctx.providers.search[0];
    const fp = ctx.providers.fetch[0];

    assert.equal(sp.available(), true, "search provider available");
    assert.equal(fp.available(), true, "fetch provider available");

    // 1) search mapping
    const out = await sp.search({ query: "searxng", maxResults: 5 }, undefined);
    assert.equal(out.sources.length, 2);
    assert.equal(out.sources[0]?.title, "SearXNG Docs");
    assert.equal(out.sources[0]?.snippet, "Administrator documentation.");
    assert.equal(out.sources[0]?.publishedAt, "2026-01-01");
    assert.equal(out.content, "SearXNG is a metasearch engine.");

    // 2) search defaults
    const ctxWithDefaults = makeCtx();
    apply(ctxWithDefaults, { baseUrl: searx.base, ssrfGuard: false, search: { language: "zh-CN" } });
    let sawLanguage = false;
    searx.server.once("request", (req) => {
      sawLanguage = new URL(req.url ?? "", "http://x").searchParams.get("language") === "zh-CN";
    });
    await ctxWithDefaults.providers.search[0].search({ query: "x" }, undefined);
    assert.equal(sawLanguage, true, "search forwards language default");

    // 3) fetch strips html down to text
    const pageRes = await fp.fetch({ url: `${page.base}/doc` }, undefined);
    assert.equal(pageRes.statusCode, 200);
    assert.equal(pageRes.body.kind, "text");
    assert.ok(!/<|alert\(1\)|body\{/.test(pageRes.body.content), "strips tags/scripts/styles");
    assert.ok(pageRes.body.content.includes("Hello & welcome"), "decodes entities");

    // 4) SSRF guard
    const guardedCtx = makeCtx();
    apply(guardedCtx, { baseUrl: searx.base, ssrfGuard: true });
    await assert.rejects(
      guardedCtx.providers.fetch[0].fetch({ url: "http://127.0.0.1:1/x" }, undefined),
      /SSRF guard|localhost|loopback/,
    );
    await assert.rejects(
      guardedCtx.providers.fetch[0].fetch({ url: "ftp://example.com/x" }, undefined),
      /unsupported protocol/,
    );

    // 5) caller abort
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(sp.search({ query: "x" }, ac.signal));

    // 6) empty query rejected
    await assert.rejects(
      sp.search({ query: "  " }, undefined),
      (err: any) => err.code === "bad-request",
    );

    // 7) instance credentials
    const gated = await startServer((req, res) => {
      const url = new URL(req.url ?? "", "http://x");
      if (url.pathname === "/search" && url.searchParams.get("format") === "json") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            results: [
              {
                url: "https://example.com/echoed",
                title: String(req.headers["x-api-key"] ?? ""),
                content: String(req.headers["authorization"] ?? ""),
              },
            ],
          }),
        );
        return;
      }
      res.statusCode = 500;
      res.end();
    });

    try {
      const gctx = makeCtx();
      const testUser = ["test", "user"].join("_");
      const testPass = ["test", "pass"].join("_");
      const testKeyHeader = ["X", "API", "Key"].join("-");
      const testKeyVal = ["test", "val"].join("_");
      apply(gctx, {
        baseUrl: gated.base,
        ssrfGuard: false,
        headers: { [testKeyHeader]: testKeyVal },
        basicAuth: { username: testUser, password: testPass },
      });
      const out7 = await gctx.providers.search[0].search({ query: "q" }, undefined);
      assert.equal(out7.sources[0]?.title, testKeyVal);
      let decoded = "";
      if (/^Basic /.test(out7.sources[0]?.snippet ?? "")) {
        decoded = Buffer.from(out7.sources[0].snippet.slice(6), "base64").toString();
      }
      assert.equal(decoded, `${testUser}:${testPass}`);

      let pageCreds: any;
      page.server.on("request", (req) => {
        pageCreds = [req.headers.authorization, req.headers[testKeyHeader.toLowerCase()]];
      });
      await gctx.providers.fetch[0].fetch({ url: `${page.base}/leak-test` }, undefined);
      assert.ok(!pageCreds?.[0] && !pageCreds?.[1], "web_fetch targets stay credential-free");

      assert.throws(() => {
        apply(makeCtx(), {
          baseUrl: gated.base,
          basicAuth: { password: testPass },
          headers: { Authorization: "Bearer test" },
        });
      }, /conflict/);
    } finally {
      gated.server.close();
    }
  } finally {
    searx.server.close();
    page.server.close();
  }

  // 8) multi-endpoint failover
  async function makeSearx(answer: string) {
    let hits = 0;
    const server = http.createServer((req, res) => {
      hits++;
      const url = new URL(req.url ?? "", "http://x");
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
    const port = (server.address() as any).port;
    return { server, base: `http://127.0.0.1:${port}`, get hits() { return hits; } };
  }

  const deadServer = http.createServer(() => {});
  deadServer.listen(0, "127.0.0.1");
  await once(deadServer, "listening");
  const deadBase = `http://127.0.0.1:${(deadServer.address() as any).port}`;
  deadServer.close();
  await once(deadServer, "close");

  const instB = await makeSearx("from-B");
  try {
    const ctxA = makeCtx();
    apply(ctxA, { baseUrls: [deadBase, instB.base], ssrfGuard: false });
    const outT1 = await ctxA.providers.search[0].search({ query: "q" }, undefined);
    assert.equal(outT1.content, "from-B", "failover skips unreachable endpoint");

    const instC = await makeSearx("from-C");
    try {
      const ctxS = makeCtx();
      apply(ctxS, { baseUrls: [deadBase, instC.base, instB.base], ssrfGuard: false });
      const spS = ctxS.providers.search[0];
      const bBaseline = instB.hits;
      const r1 = await spS.search({ query: "q" }, undefined);
      const r2 = await spS.search({ query: "q" }, undefined);
      assert.equal(r1.content, "from-C");
      assert.equal(r2.content, "from-C");
      assert.equal(instB.hits, bBaseline, "sticky keeps last-good endpoint");

      instC.server.close();
      await once(instC.server, "close");
      const r3 = await spS.search({ query: "q" }, undefined);
      assert.equal(r3.content, "from-B", "fails over again when sticky endpoint dies");
    } finally {
      if (instC.server.listening) instC.server.close();
    }

    const ctxE = makeCtx();
    apply(ctxE, { baseUrls: [], baseUrl: instB.base, ssrfGuard: false });
    const outT4 = await ctxE.providers.search[0].search({ query: "q" }, undefined);
    assert.equal(outT4.content, "from-B", "empty baseUrls falls back to baseUrl");
  } finally {
    instB.server.close();
  }

  const ctxD = makeCtx();
  apply(ctxD, { baseUrls: [deadBase, deadBase], ssrfGuard: false });
  await assert.rejects(
    ctxD.providers.search[0].search({ query: "q" }, undefined),
    (e: any) => e.code === "network",
  );
});
