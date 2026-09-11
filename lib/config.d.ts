import Schema from "@deepseek-ai/schemastery";
import type { SearxngWebConfig } from "./types.js";
/**
 * Loader-time configuration schema (docs/user/develop/basic/config).
 * Defaults mirror defensive fallbacks so behavior is identical
 * whether the value comes from the schema or direct callers.
 */
export declare const Config: Schema<SearxngWebConfig>;
/** Strip trailing slashes from the instance base URL. */
export declare function normalizeBaseUrl(raw: string): string;
