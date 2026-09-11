/** fetch() under BOTH the caller signal and a hard timeout. */
export declare function fetchBounded(url: URL | string, init: RequestInit, timeoutMs: number, callerSignal?: AbortSignal): Promise<Response>;
