// Standalone smoke test for @maxwell-feng/dsh-searxng-web (no harness needed).
import { apply } from "../index.js";

const searchProviders = [];
const fetchProviders = [];
const ctx = {
  web: {
    registerSearchProvider: (p) => searchProviders.push(p),
    registerFetchProvider: (p) => fetchProviders.push(p),
  },
  logger: { info: (m) => console.log(m) },
};

apply(ctx, { baseUrl: "http://10.42.1.159:8080" });

const sp = searchProviders[0];
const fp = fetchProviders[0];

console.log("search available:", sp.available(), "| fetch available:", fp.available());

// 1) real search
const out = await sp.search({ query: "searxng metasearch", maxResults: 5 }, undefined);
console.log(`search OK: ${out.sources.length} sources, first: ${out.sources[0]?.title ?? out.sources[0]?.url}`);

// 2) real fetch of a public page (html → text)
const page = await fp.fetch({ url: "https://example.com" }, undefined);
console.log(`fetch OK: HTTP ${page.statusCode}, chars=${page.body.content.length}, truncated=${page.truncated}`);
console.log("fetch head:", JSON.stringify(page.body.content.slice(0, 80)));

// 3) SSRF guard must refuse loopback target
try {
  await fp.fetch({ url: "http://127.0.0.1:8080/search?q=x" }, undefined);
  console.log("SSRF GUARD FAIL: private target was allowed");
} catch (e) {
  console.log("SSRF guard ok:", e.message);
}

// 4) caller abort propagates
const ac = new AbortController();
ac.abort();
try {
  await sp.search({ query: "x" }, ac.signal);
  console.log("abort FAIL: no error");
} catch (e) {
  console.log("caller abort propagated:", e.name === "AbortError" || e.code === "aborted" ? "yes" : `NO (${e.name})`);
}
