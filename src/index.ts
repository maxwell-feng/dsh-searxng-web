// @maxwell-feng/dsh-searxng-web — DeepSeek Harness (dsh) plugin.
//
// Registers one `ctx.web` search provider and one fetch provider so the
// model-facing native `web_search` / `web_fetch` tools execute against a
// self-hosted SearXNG instance instead of a third-party search vendor.
//
// Design notes:
// - Function-form plugin per docs/user/develop/basic: exports `name`,
//   `inject`, and `apply(ctx, config)`. The bundle's cordis.patch.yml inserts
//   the loader row and carries the config. A Schemastery `Config` schema
//   validates user configuration at load time (docs/user/develop/basic/config);
//   apply() still reads defensively so direct callers (tests) work too.
// - The search adapter queries the SearXNG JSON API
//   (GET {baseUrl}/search?format=json). The instance URL is operator
//   configured and trusted by definition.
// - Instance credentials (`basicAuth`, `headers`) attach ONLY to requests
//   bound for the configured SearXNG instance. They are NEVER applied to
//   web_fetch targets: those URLs are model-chosen third-party pages, and
//   leaking an API key or proxy password there would hand it to a stranger.
// - The fetch adapter performs a bounded GET of the requested URL. Because a
//   fetch provider lets the MODEL choose the request target, an SSRF guard
//   refuses private/loopback/link-local targets by default (opt out with
//   `ssrfGuard: false` for closed deployments). Known limitation: the guard
//   validates the initial URL only — redirects are followed by fetch() and
//   not re-validated in v1.
// - TypeScript source lives in src/; the compiled lib/index.js is COMMITTED,
//   so git installs load without any prepare script or pnpm allowBuilds
//   entry. Rebuild with `npm run build` after editing the source.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";

/** Cordis plugin name used by loader diagnostics. */
export const name = "searxng-web";

/** Services required by this plugin; ready before apply() runs. */
export const inject = ["web"];

const SEARCH_PROVIDER_ID = "searxng-web";
const FETCH_PROVIDER_ID = "searxng-web-fetch";
const MAX_RESULTS_CAP = 50;

// ---------------------------------------------------------------------------
// Public types (structural mirrors of the ctx.web seam contracts).
// ---------------------------------------------------------------------------

export interface SearchDefaults {
    language?: string;
    safesearch?: number | string;
    categories?: string;
    engines?: string;
    timeRange?: string;
}

export interface BasicAuthConfig {
    username?: string;
    password?: string;
}

export interface SearxngWebConfig {
    /** SearXNG instance base URL. Default: http://127.0.0.1:8080 */
    baseUrl?: string;
    /**
     * Ordered SearXNG endpoints with automatic failover. When non-empty this
     * list takes precedence over `baseUrl`. Attempts always start at the last
     * endpoint that succeeded (sticky) and walk the rest of the list once;
     * only network-level failures (connection refused / unreachable / timeout /
     * DNS) trigger a switch — an HTTP answer from any door proves that door is
     * alive and its status is surfaced as-is without failover.
     *
     * Typical triple-stack deployment for a home instance:
     * `[public-IPv4, public-IPv6, LAN-IPv4]`.
     */
    baseUrls?: string[];
    /** Per-search attempt budget, ms. Default 15000. */
    timeoutMs?: number;
    /** Per-fetch attempt budget, ms. Default 30000. */
    fetchTimeoutMs?: number;
    /** Cap on characters returned by web_fetch. Default 200000. */
    fetchMaxChars?: number;
    /** Refuse private/loopback fetch targets. Default true. */
    ssrfGuard?: boolean;
    /**
     * Extra HTTP headers attached to every request sent TO the SearXNG
     * instance (search API calls). Never applied to web_fetch targets —
     * those are model-chosen third-party pages and must stay credential-free.
     * Use for header-based gates, e.g. `{ "X-API-Key": "..." }`.
     */
    headers?: Record<string, string>;
    /**
     * Basic-auth credentials for instances behind an authenticating reverse
     * proxy (caddy basic_auth, nginx auth_basic). Sets the Authorization
     * header on SearXNG requests. Conflicts with a user-supplied
     * `headers.Authorization` fail at load time.
     */
    basicAuth?: BasicAuthConfig;
    /** SearXNG query defaults forwarded on every search. */
    search?: SearchDefaults;
}

/**
 * Loader-time configuration schema (docs/user/develop/basic/config).
 * Defaults mirror apply()'s defensive fallbacks so behavior is identical
 * whether the value comes from the schema or from direct callers.
 */
export const Config: Schema<SearxngWebConfig> = Schema.object({
    baseUrl: Schema.string().default("http://127.0.0.1:8080"),
    baseUrls: Schema.array(Schema.string()),
    timeoutMs: Schema.number().default(15000),
    fetchTimeoutMs: Schema.number().default(30000),
    fetchMaxChars: Schema.number().default(200_000),
    ssrfGuard: Schema.boolean().default(true),
    headers: Schema.dict(Schema.string()),
    basicAuth: Schema.object({
        username: Schema.string(),
        password: Schema.string(),
    }),
    search: Schema.object({
        language: Schema.string(),
        safesearch: Schema.union([Schema.number(), Schema.string()]).default(0),
        categories: Schema.string(),
        engines: Schema.string(),
        timeRange: Schema.string(),
    }),
});

export interface Source {
    url: string;
    title?: string;
    snippet?: string;
    publishedAt?: string;
}

export interface SearchOutcome {
    sources: Source[];
    truncated: boolean;
    content?: string;
}

export interface FetchOutcome {
    url: string;
    statusCode: number;
    body: { kind: "text"; content: string };
    truncated: boolean;
}

interface WebSearchProvider {
    id: string;
    available(): boolean;
    search(request: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<SearchOutcome>;
}

interface WebFetchProvider {
    id: string;
    available(): boolean;
    fetch(request: { url: string }, signal?: AbortSignal): Promise<FetchOutcome>;
}

interface WebService {
    registerSearchProvider(provider: WebSearchProvider): () => void;
    registerFetchProvider(provider: WebFetchProvider): () => void;
}

type PluginContext = Context & { web: WebService; logger?: { info?(message: string): void } };

/** Build a classified ProviderError (code mirrors the dsh-web seam codes). */
function providerError(code: string, message: string, status?: number): Error & { code: string; status?: number } {
    const err = new Error(message) as Error & { code: string; status?: number };
    err.code = code;
    if (status !== undefined) err.status = status;
    return err;
}

/** Strip trailing slashes from the instance base URL. */
function normalizeBaseUrl(raw: string): string {
    return raw.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// SSRF guard: classify whether a host resolves to a private/loopback range.
// ---------------------------------------------------------------------------

function isPrivateIPv4(ip: string): boolean {
    const o = ip.split(".").map(Number);
    if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    if (o[0] === 0 || o[0] === 10 || o[0] === 127) return true; // this-network, private, loopback
    if (o[0] === 169 && o[1] === 254) return true; // link-local
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // private
    if (o[0] === 192 && o[1] === 168) return true; // private
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT
    return false;
}

function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true; // unspecified, loopback
    if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
    if (/^f[cd]/.test(lower)) return true; // unique-local fc00::/7
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(lower);
    if (mapped) return isPrivateIPv4(mapped[1]); // v4-mapped
    return false;
}

function isPrivateIp(ip: string): boolean {
    const family = isIP(ip);
    if (family === 4) return isPrivateIPv4(ip);
    if (family === 6) return isPrivateIPv6(ip);
    return true; // unparseable → refuse
}

/**
 * Validate a fetch target. Returns the URL object or throws a classified
 * error. With the guard on, every address the hostname resolves to must be
 * public; literal IPs are checked directly.
 */
async function resolveFetchTarget(urlStr: string, guard: boolean): Promise<URL> {
    let url: URL;
    try {
        url = new URL(urlStr);
    } catch {
        throw providerError("bad-request", `invalid URL: ${urlStr}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw providerError("bad-request", `unsupported protocol: ${url.protocol}`);
    }
    if (!guard) return url;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    let addresses: Array<{ address: string }>;
    try {
        addresses = await lookup(host, { all: true });
    } catch {
        throw providerError("network", `cannot resolve host: ${host}`);
    }
    if (addresses.some((a) => isPrivateIp(a.address))) {
        throw providerError("bad-request", "refusing private/loopback target (SSRF guard); set ssrfGuard:false to allow");
    }
    return url;
}

// ---------------------------------------------------------------------------
// Fetch helpers.
// ---------------------------------------------------------------------------

/** fetch() under BOTH the caller signal and a hard timeout. */
async function fetchBounded(url: URL | string, init: RequestInit, timeoutMs: number, callerSignal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();
    try {
        return await fetch(url, {
            ...init,
            signal: AbortSignal.any([controller.signal, ...(callerSignal ? [callerSignal] : [])]),
        });
    } catch (error) {
        // Caller cancellation propagates untouched so dsh-web keeps its abort semantics.
        if (callerSignal?.aborted) throw error;
        const cause = (error as { cause?: unknown })?.cause ?? error;
        const detail = cause instanceof Error ? cause.message : String(cause ?? "");
        const origin = typeof url === "string" ? url : url.origin;
        throw providerError("network", `request failed (${origin}): ${detail || (error as Error).message}`);
    } finally {
        clearTimeout(timer);
    }
}

const ENTITY_MAP: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
};

/** Reduce HTML to readable text: drop script/style/comments/tags, decode entities, squash whitespace. */
export function htmlToText(html: string): string {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<\/(?:p|div|section|article|li|tr|h[1-6])>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITY_MAP[m])
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

interface SearxngResult {
    url?: unknown;
    title?: unknown;
    content?: unknown;
    publishedDate?: unknown;
}

// ---------------------------------------------------------------------------
// Plugin entry.
// ---------------------------------------------------------------------------

export function apply(ctx: Context, config: Partial<SearxngWebConfig> = {}): void {
    const baseUrl = normalizeBaseUrl(
        typeof config.baseUrl === "string" && config.baseUrl.trim()
            ? config.baseUrl.trim()
            : "http://127.0.0.1:8080",
    );
    // Resolve the effective endpoint list: baseUrls (trimmed, deduped) wins
    // when non-empty; otherwise fall back to the single baseUrl.
    const endpoints: string[] = (() => {
        const list: string[] = [];
        if (Array.isArray(config.baseUrls)) {
            for (const item of config.baseUrls) {
                if (typeof item === "string" && item.trim()) list.push(normalizeBaseUrl(item.trim()));
            }
        }
        const unique = Array.from(new Set(list));
        return unique.length > 0 ? unique : [baseUrl];
    })();
    // Index of the endpoint the next attempt starts from. Updated on every
    // success so a healthy door is not re-probed after a transient failure
    // of an earlier entry ("sticky failover").
    let stickyIndex = 0;
    const searchTimeoutMs = typeof config.timeoutMs === "number" && config.timeoutMs > 0 ? config.timeoutMs : 15000;
    const fetchTimeoutMs =
        typeof config.fetchTimeoutMs === "number" && config.fetchTimeoutMs > 0 ? config.fetchTimeoutMs : 30000;
    const fetchMaxChars =
        typeof config.fetchMaxChars === "number" && config.fetchMaxChars > 0 ? config.fetchMaxChars : 200_000;
    const ssrfGuard = config.ssrfGuard !== false;
    const defaults: SearchDefaults =
        typeof config.search === "object" && config.search !== null ? config.search : {};

    // Resolve instance credentials (SearXNG-bound requests only — never
    // web_fetch targets, which are model-chosen third-party pages).
    const instanceHeaders: Record<string, string> = {};
    if (typeof config.headers === "object" && config.headers !== null) {
        for (const [key, value] of Object.entries(config.headers)) {
            if (typeof key === "string" && key !== "" && typeof value === "string") {
                instanceHeaders[key] = value;
            }
        }
    }
    const hasHeader = (name: string) =>
        Object.keys(instanceHeaders).some((h) => h.toLowerCase() === name.toLowerCase());
    if (
        typeof config.basicAuth === "object" &&
        config.basicAuth !== null &&
        (typeof config.basicAuth.username === "string" || typeof config.basicAuth.password === "string")
    ) {
        if (hasHeader("authorization")) {
            throw new Error(
                "[searxng-web] configuration conflict: basicAuth sets Authorization but headers already defines one; keep only one mechanism",
            );
        }
        const token = Buffer.from(
            `${config.basicAuth.username ?? ""}:${config.basicAuth.password ?? ""}`,
        ).toString("base64");
        instanceHeaders.Authorization = `Basic ${token}`;
    }
    const hasInstanceCredentials = Object.keys(instanceHeaders).length > 0;

    /**
     * Query ONE endpoint's SearXNG JSON API and map to the ctx.web search
     * outcome shape. Network failures surface as providerError("network");
     * HTTP-level problems keep their dedicated codes.
     */
    async function searchEndpoint(endpoint: string, query: string, maxResults: number | undefined, signal?: AbortSignal): Promise<SearchOutcome> {
        const url = new URL(`${endpoint}/search`);
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("safesearch", String(defaults.safesearch ?? 0));
        for (const [param, key] of [
            ["language", "language"],
            ["categories", "categories"],
            ["engines", "engines"],
            ["time_range", "timeRange"],
        ] as const) {
            const value = defaults[key];
            if (typeof value === "string" && value.trim()) url.searchParams.set(param, value.trim());
        }

        // fetchBounded classifies network/timeout failures and rethrows
        // caller aborts untouched. Instance credentials ride along here.
        const res = await fetchBounded(
            url,
            { headers: { accept: "application/json", ...instanceHeaders } },
            searchTimeoutMs,
            signal,
        );
        if (!res.ok) {
            if (res.status === 403) {
                throw providerError(
                    "auth",
                    hasInstanceCredentials
                        ? "SearXNG/proxy refused the request (403) — check basicAuth/headers credentials and that JSON output is enabled (search.formats: [html, json])"
                        : "SearXNG refused the request (403) — enable JSON output in settings.yml (search.formats: [html, json])",
                    res.status,
                );
            }
            if (res.status >= 500) throw providerError("server", `SearXNG server error (HTTP ${res.status})`, res.status);
            throw providerError("bad-request", `SearXNG request failed (HTTP ${res.status})`, res.status);
        }
        const raw = (await res.json()) as { results?: SearxngResult[]; answer?: unknown };
        const results = Array.isArray(raw?.results) ? raw.results : [];
        const limit =
            typeof maxResults === "number" && Number.isInteger(maxResults) && maxResults > 0
                ? Math.min(maxResults, MAX_RESULTS_CAP)
                : undefined;
        const sources = results
            .slice(0, limit)
            .map((r): Source | null => {
                const u = typeof r?.url === "string" ? r.url : "";
                if (!u) return null;
                const s: Source = { url: u };
                if (typeof r.title === "string" && r.title) s.title = r.title;
                if (typeof r.content === "string" && r.content) s.snippet = r.content;
                if (typeof r.publishedDate === "string" && r.publishedDate) s.publishedAt = r.publishedDate;
                return s;
            })
            .filter((s): s is Source => s !== null);
        const outcome: SearchOutcome = { sources, truncated: false };
        if (typeof raw?.answer === "string" && raw.answer) outcome.content = raw.answer;
        return outcome;
    }

    /**
     * Sticky-failover search across `endpoints`. Attempts start at
     * `stickyIndex` and walk the list exactly once. Only network-level errors
     * ("network" code from fetchBounded) advance to the next endpoint; HTTP
     * answers and caller aborts propagate immediately.
     */
    async function searxSearch(query: string, maxResults: number | undefined, signal?: AbortSignal): Promise<SearchOutcome> {
        let lastNetworkError: unknown;
        for (let attempt = 0; attempt < endpoints.length; attempt++) {
            const idx = (stickyIndex + attempt) % endpoints.length;
            try {
                const outcome = await searchEndpoint(endpoints[idx], query, maxResults, signal);
                stickyIndex = idx;
                return outcome;
            } catch (err) {
                // Caller cancellation is never a failover signal.
                if (signal?.aborted) throw err;
                // A door that ANSWERED (any HTTP status) is alive — surface
                // its error instead of silently trying other doors.
                if ((err as { code?: string })?.code !== "network") throw err;
                lastNetworkError = err;
            }
        }
        throw lastNetworkError ?? providerError("network", "all configured SearXNG endpoints failed");
    }

    const web = (ctx as PluginContext).web;

    // ---- ctx.web search provider -------------------------------------------
    web.registerSearchProvider({
        id: SEARCH_PROVIDER_ID,
        available() {
            return endpoints.length > 0;
        },
        async search(request, signal) {
            const query = typeof request?.query === "string" ? request.query.trim() : "";
            if (!query) throw providerError("bad-request", "web_search received an empty query");
            return await searxSearch(query, request?.maxResults, signal);
        },
    });

    // ---- ctx.web fetch provider --------------------------------------------
    web.registerFetchProvider({
        id: FETCH_PROVIDER_ID,
        available() {
            return endpoints.length > 0;
        },
        async fetch(request, signal) {
            const targetUrl = typeof request?.url === "string" ? request.url : "";
            if (!targetUrl) throw providerError("bad-request", "web_fetch received an empty URL");
            const url = await resolveFetchTarget(targetUrl, ssrfGuard);

            const res = await fetchBounded(
                url,
                {
                    headers: {
                        // Some sites reject requests without a browser-ish UA.
                        "user-agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                        accept: "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.7",
                    },
                    redirect: "follow",
                },
                fetchTimeoutMs,
                signal,
            );
            if (!res.ok) {
                const code = res.status >= 500 ? "server" : res.status === 401 || res.status === 403 ? "auth" : "bad-request";
                throw providerError(code, `fetch failed (HTTP ${res.status}) for ${targetUrl}`, res.status);
            }
            const rawBody = await res.text();
            const contentType = String(res.headers.get("content-type") ?? "");
            const text = /html/i.test(contentType) ? htmlToText(rawBody) : rawBody;
            const truncated = text.length > fetchMaxChars;
            return {
                url: res.url || targetUrl,
                statusCode: res.status,
                body: { kind: "text", content: truncated ? text.slice(0, fetchMaxChars) : text },
                truncated,
            };
        },
    });

    (ctx as PluginContext).logger?.info?.(
        `[searxng-web] providers registered (${endpoints.length} endpoint(s); primary: ${endpoints[0]})`,
    );
}
