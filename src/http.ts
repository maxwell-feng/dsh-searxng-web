import { providerError } from "./types.ts";

/** fetch() under BOTH the caller signal and a hard timeout. */
export async function fetchBounded(
    url: URL | string,
    init: RequestInit,
    timeoutMs: number,
    callerSignal?: AbortSignal,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();
    try {
        return await fetch(url, {
            ...init,
            signal: AbortSignal.any([controller.signal, ...(callerSignal ? [callerSignal] : [])]),
        });
    } catch (error) {
        // Caller cancellation propagates untouched so dsh-web keeps its abort semantics.
        if (callerSignal?.aborted) throw error;
        const cause = (error as { cause?: unknown })?.cause ?? error;
        const detail = cause instanceof Error ? cause.message : String(cause ?? "");
        const origin = typeof url === "string" ? url : url.origin;
        throw providerError("network", `request failed (${origin}): ${detail || (error as Error).message}`);
    } finally {
        clearTimeout(timer);
    }
}
