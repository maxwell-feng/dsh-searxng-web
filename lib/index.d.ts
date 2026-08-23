import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "searxng-web";
/** Services required by this plugin; ready before apply() runs. */
export declare const inject: string[];
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
export declare const Config: Schema<SearxngWebConfig>;
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
/** Reduce HTML to readable text: drop script/style/comments/tags, decode entities, squash whitespace. */
export declare function htmlToText(html: string): string;
export declare function apply(ctx: Context, config?: Partial<SearxngWebConfig>): void;
