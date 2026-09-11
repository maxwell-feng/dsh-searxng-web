// dsh-searxng-web — DeepSeek Harness (dsh) plugin.
//
// Registers one `ctx.web` search provider and one fetch provider so the
// model-facing native `web_search` / `web_fetch` tools execute against a
// self-hosted SearXNG instance instead of a third-party search vendor.

import type { Context } from "@deepseek-ai/cordis";
import { Config, normalizeBaseUrl } from "./config.ts";
import { SearxngFetchProvider } from "./fetch-provider.ts";
import { SearxngSearchProvider } from "./search-provider.ts";
import type {
    PluginContext,
    SearchDefaults,
    SearxngWebConfig,
} from "./types.ts";

/** Cordis plugin name used by loader diagnostics. */
export const name = "searxng-web";

/** Services required by this plugin; ready before apply() runs. */
export const inject = ["web"];

export { Config, normalizeBaseUrl } from "./config.ts";
export { htmlToText } from "./html.ts";
export { SearxngSearchProvider } from "./search-provider.ts";
export { SearxngFetchProvider } from "./fetch-provider.ts";
export { isPrivateIp, isPrivateIPv4, isPrivateIPv6, resolveFetchTarget } from "./ssrf.ts";
export * from "./types.ts";

/**
 * Plugin entry point. Configures and registers the search and fetch providers
 * on the `ctx.web` service seam.
 */
export function apply(ctx: Context, config: Partial<SearxngWebConfig> = {}): void {
    const baseUrl = normalizeBaseUrl(
        typeof config.baseUrl === "string" && config.baseUrl.trim()
            ? config.baseUrl.trim()
            : "http://127.0.0.1:8080",
    );

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

    const searchTimeoutMs = typeof config.timeoutMs === "number" && config.timeoutMs > 0 ? config.timeoutMs : 15000;
    const fetchTimeoutMs =
        typeof config.fetchTimeoutMs === "number" && config.fetchTimeoutMs > 0 ? config.fetchTimeoutMs : 30000;
    const fetchMaxChars =
        typeof config.fetchMaxChars === "number" && config.fetchMaxChars > 0 ? config.fetchMaxChars : 200_000;
    const ssrfGuard = config.ssrfGuard !== false;
    const defaults: SearchDefaults =
        typeof config.search === "object" && config.search !== null ? config.search : {};

    const instanceHeaders: Record<string, string> = {};
    if (typeof config.headers === "object" && config.headers !== null) {
        for (const [key, value] of Object.entries(config.headers)) {
            if (typeof key === "string" && key !== "" && typeof value === "string") {
                instanceHeaders[key] = value;
            }
        }
    }
    const hasHeader = (headerName: string) =>
        Object.keys(instanceHeaders).some((h) => h.toLowerCase() === headerName.toLowerCase());

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

    const web = (ctx as PluginContext).web;

    const searchProvider = new SearxngSearchProvider({
        endpoints,
        defaults,
        instanceHeaders,
        hasInstanceCredentials,
        searchTimeoutMs,
    });
    web.registerSearchProvider(searchProvider);

    const fetchProvider = new SearxngFetchProvider({
        endpointsCount: endpoints.length,
        fetchTimeoutMs,
        fetchMaxChars,
        ssrfGuard,
    });
    web.registerFetchProvider(fetchProvider);

    (ctx as PluginContext).logger?.info?.(
        `[searxng-web] providers registered (${endpoints.length} endpoint(s); primary: ${endpoints[0]})`,
    );
}
