import Schema from "@deepseek-ai/schemastery";
import type { SearxngWebConfig } from "./types.ts";

/**
 * Loader-time configuration schema (docs/user/develop/basic/config).
 * Defaults mirror defensive fallbacks so behavior is identical
 * whether the value comes from the schema or direct callers.
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

/** Strip trailing slashes from the instance base URL. */
export function normalizeBaseUrl(raw: string): string {
    return raw.replace(/\/+$/, "");
}
