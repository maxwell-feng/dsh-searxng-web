import type { Context } from "@deepseek-ai/cordis";
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
     */
    headers?: Record<string, string>;
    /**
     * Basic-auth credentials for instances behind an authenticating reverse
     * proxy. Sets the Authorization header on SearXNG requests.
     */
    basicAuth?: BasicAuthConfig;
    /** SearXNG query defaults forwarded on every search. */
    search?: SearchDefaults;
}
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
    body: {
        kind: "text";
        content: string;
    };
    truncated: boolean;
}
export interface WebSearchProvider {
    id: string;
    available(): boolean;
    search(request: {
        query: string;
        maxResults?: number;
    }, signal?: AbortSignal): Promise<SearchOutcome>;
}
export interface WebFetchProvider {
    id: string;
    available(): boolean;
    fetch(request: {
        url: string;
    }, signal?: AbortSignal): Promise<FetchOutcome>;
}
export interface WebService {
    registerSearchProvider(provider: WebSearchProvider): () => void;
    registerFetchProvider(provider: WebFetchProvider): () => void;
}
export type PluginContext = Context & {
    web: WebService;
    logger?: {
        info?(message: string): void;
        warn?(message: string): void;
        error?(message: string): void;
    };
};
export interface ProviderError extends Error {
    code: string;
    status?: number;
}
/** Build a classified ProviderError (code mirrors the dsh-web seam codes). */
export declare function providerError(code: string, message: string, status?: number): ProviderError;
