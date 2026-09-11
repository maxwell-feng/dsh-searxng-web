import { fetchBounded } from "./http.js";
import {
    providerError,
    type SearchDefaults,
    type SearchOutcome,
    type Source,
    type WebSearchProvider,
} from "./types.js";

const SEARCH_PROVIDER_ID = "searxng-web";
const MAX_RESULTS_CAP = 50;

interface SearxngResultItem {
    url?: unknown;
    title?: unknown;
    content?: unknown;
    publishedDate?: unknown;
}

export interface SearchProviderOptions {
    endpoints: string[];
    defaults: SearchDefaults;
    instanceHeaders: Record<string, string>;
    hasInstanceCredentials: boolean;
    searchTimeoutMs: number;
}

export class SearxngSearchProvider implements WebSearchProvider {
    public readonly id = SEARCH_PROVIDER_ID;
    private endpoints: string[];
    private defaults: SearchDefaults;
    private instanceHeaders: Record<string, string>;
    private hasInstanceCredentials: boolean;
    private searchTimeoutMs: number;
    private stickyIndex = 0;

    constructor(options: SearchProviderOptions) {
        this.endpoints = options.endpoints;
        this.defaults = options.defaults;
        this.instanceHeaders = options.instanceHeaders;
        this.hasInstanceCredentials = options.hasInstanceCredentials;
        this.searchTimeoutMs = options.searchTimeoutMs;
    }

    public available(): boolean {
        return this.endpoints.length > 0;
    }

    public async search(request: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<SearchOutcome> {
        const query = typeof request?.query === "string" ? request.query.trim() : "";
        if (!query) throw providerError("bad-request", "web_search received an empty query");
        return await this.searxSearch(query, request?.maxResults, signal);
    }

    private async searchEndpoint(
        endpoint: string,
        query: string,
        maxResults: number | undefined,
        signal?: AbortSignal,
    ): Promise<SearchOutcome> {
        const url = new URL(`${endpoint}/search`);
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("safesearch", String(this.defaults.safesearch ?? 0));
        for (const [param, key] of [
            ["language", "language"],
            ["categories", "categories"],
            ["engines", "engines"],
            ["time_range", "timeRange"],
        ] as const) {
            const value = this.defaults[key];
            if (typeof value === "string" && value.trim()) url.searchParams.set(param, value.trim());
        }

        const res = await fetchBounded(
            url,
            { headers: { accept: "application/json", ...this.instanceHeaders } },
            this.searchTimeoutMs,
            signal,
        );
        if (!res.ok) {
            if (res.status === 403) {
                throw providerError(
                    "auth",
                    this.hasInstanceCredentials
                        ? "SearXNG/proxy refused the request (403) — check basicAuth/headers credentials and that JSON output is enabled (search.formats: [html, json])"
                        : "SearXNG refused the request (403) — enable JSON output in settings.yml (search.formats: [html, json])",
                    res.status,
                );
            }
            if (res.status >= 500) throw providerError("server", `SearXNG server error (HTTP ${res.status})`, res.status);
            throw providerError("bad-request", `SearXNG request failed (HTTP ${res.status})`, res.status);
        }
        const raw = (await res.json()) as { results?: SearxngResultItem[]; answer?: unknown };
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

    private async searxSearch(query: string, maxResults: number | undefined, signal?: AbortSignal): Promise<SearchOutcome> {
        let lastNetworkError: unknown;
        for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
            const idx = (this.stickyIndex + attempt) % this.endpoints.length;
            try {
                const outcome = await this.searchEndpoint(this.endpoints[idx], query, maxResults, signal);
                this.stickyIndex = idx;
                return outcome;
            } catch (err) {
                if (signal?.aborted) throw err;
                if ((err as { code?: string })?.code !== "network") throw err;
                lastNetworkError = err;
            }
        }
        throw lastNetworkError ?? providerError("network", "all configured SearXNG endpoints failed");
    }
}
