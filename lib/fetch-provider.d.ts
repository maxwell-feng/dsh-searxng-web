import { type FetchOutcome, type WebFetchProvider } from "./types.js";
export interface FetchProviderOptions {
    endpointsCount: number;
    fetchTimeoutMs: number;
    fetchMaxChars: number;
    ssrfGuard: boolean;
}
export declare class SearxngFetchProvider implements WebFetchProvider {
    readonly id = "searxng-web-fetch";
    private endpointsCount;
    private fetchTimeoutMs;
    private fetchMaxChars;
    private ssrfGuard;
    constructor(options: FetchProviderOptions);
    available(): boolean;
    fetch(request: {
        url: string;
    }, signal?: AbortSignal): Promise<FetchOutcome>;
}
