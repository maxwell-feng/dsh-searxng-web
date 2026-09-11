import type { Context } from "@deepseek-ai/cordis";
import type { SearxngWebConfig } from "./types.js";
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "searxng-web";
/** Services required by this plugin; ready before apply() runs. */
export declare const inject: string[];
export { Config, normalizeBaseUrl } from "./config.js";
export { htmlToText } from "./html.js";
export { SearxngSearchProvider } from "./search-provider.js";
export { SearxngFetchProvider } from "./fetch-provider.js";
export { isPrivateIp, isPrivateIPv4, isPrivateIPv6, resolveFetchTarget } from "./ssrf.js";
export * from "./types.js";
/**
 * Plugin entry point. Configures and registers the search and fetch providers
 * on the `ctx.web` service seam.
 */
export declare function apply(ctx: Context, config?: Partial<SearxngWebConfig>): void;
