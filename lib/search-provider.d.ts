import { type SearchDefaults, type SearchOutcome, type WebSearchProvider } from "./types.js";
export interface SearchProviderOptions {
    endpoints: string[];
    defaults: SearchDefaults;
    instanceHeaders: Record<string, string>;
    hasInstanceCredentials: boolean;
    searchTimeoutMs: number;
}
export declare class SearxngSearchProvider implements WebSearchProvider {
    readonly id = "searxng-web";
    private endpoints;
    private defaults;
    private instanceHeaders;
    private hasInstanceCredentials;
    private searchTimeoutMs;
    private stickyIndex;
    constructor(options: SearchProviderOptions);
    available(): boolean;
    search(request: {
        query: string;
        maxResults?: number;
    }, signal?: AbortSignal): Promise<SearchOutcome>;
    private searchEndpoint;
    private searxSearch;
}
