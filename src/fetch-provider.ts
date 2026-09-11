import { htmlToText } from "./html.ts";
import { fetchBounded } from "./http.ts";
import { resolveFetchTarget } from "./ssrf.ts";
import {
    providerError,
    type FetchOutcome,
    type WebFetchProvider,
} from "./types.ts";

const FETCH_PROVIDER_ID = "searxng-web-fetch";

export interface FetchProviderOptions {
    endpointsCount: number;
    fetchTimeoutMs: number;
    fetchMaxChars: number;
    ssrfGuard: boolean;
}

export class SearxngFetchProvider implements WebFetchProvider {
    public readonly id = FETCH_PROVIDER_ID;
    private endpointsCount: number;
    private fetchTimeoutMs: number;
    private fetchMaxChars: number;
    private ssrfGuard: boolean;

    constructor(options: FetchProviderOptions) {
        this.endpointsCount = options.endpointsCount;
        this.fetchTimeoutMs = options.fetchTimeoutMs;
        this.fetchMaxChars = options.fetchMaxChars;
        this.ssrfGuard = options.ssrfGuard;
    }

    public available(): boolean {
        return this.endpointsCount > 0;
    }

    public async fetch(request: { url: string }, signal?: AbortSignal): Promise<FetchOutcome> {
        const targetUrl = typeof request?.url === "string" ? request.url : "";
        if (!targetUrl) throw providerError("bad-request", "web_fetch received an empty URL");
        const url = await resolveFetchTarget(targetUrl, this.ssrfGuard);

        const res = await fetchBounded(
            url,
            {
                headers: {
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                    accept: "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.7",
                },
                redirect: "follow",
            },
            this.fetchTimeoutMs,
            signal,
        );
        if (!res.ok) {
            const code = res.status >= 500 ? "server" : res.status === 401 || res.status === 403 ? "auth" : "bad-request";
            throw providerError(code, `fetch failed (HTTP ${res.status}) for ${targetUrl}`, res.status);
        }
        const rawBody = await res.text();
        const contentType = String(res.headers.get("content-type") ?? "");
        const text = /html/i.test(contentType) ? htmlToText(rawBody) : rawBody;
        const truncated = text.length > this.fetchMaxChars;
        return {
            url: res.url || targetUrl,
            statusCode: res.status,
            body: { kind: "text", content: truncated ? text.slice(0, this.fetchMaxChars) : text },
            truncated,
        };
    }
}
