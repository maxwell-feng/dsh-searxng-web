import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { providerError } from "./types.js";

/** Check if an IPv4 address is in loopback, private, link-local, or reserved ranges. */
export function isPrivateIPv4(ip: string): boolean {
    const o = ip.split(".").map(Number);
    if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    if (o[0] === 0 || o[0] === 10 || o[0] === 127) return true; // current network, RFC 1918, loopback
    if (o[0] === 169 && o[1] === 254) return true; // link-local
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // RFC 1918
    if (o[0] === 192 && o[1] === 168) return true; // RFC 1918
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT RFC 6598
    if (o[0] >= 224) return true; // multicast and reserved (class D & E)
    return false;
}

/** Check if an IPv6 address is loopback, link-local, unique-local, or IPv4-mapped private. */
export function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true; // unspecified, loopback
    if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
    if (/^f[cd]/.test(lower)) return true; // unique-local fc00::/7
    const match = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (match && match[1]) return isPrivateIPv4(match[1]); // IPv4-mapped
    return false;
}

/** Check if an IP address string is private or reserved. */
export function isPrivateIp(ip: string): boolean {
    const family = isIP(ip);
    if (family === 4) return isPrivateIPv4(ip);
    if (family === 6) return isPrivateIPv6(ip);
    return true; // unparseable -> refuse
}

/**
 * Validate a fetch target. Returns the parsed URL or throws providerError.
 * When guard is enabled:
 *  - Only http: and https: protocols are permitted.
 *  - Hostname is validated before request dispatch.
 *  - Rejects localhost, loopback, private, link-local, and reserved IP ranges.
 */
export async function resolveFetchTarget(urlStr: string, guard: boolean): Promise<URL> {
    let url: URL;
    try {
        url = new URL(urlStr);
    } catch {
        throw providerError("bad-request", "invalid URL");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw providerError("bad-request", "unsupported protocol");
    }
    if (!guard) return url;

    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw providerError("bad-request", "refusing localhost target (SSRF guard); set ssrfGuard:false to allow");
    }

    const host = url.hostname.replace(/^\[|\]$/g, "");
    let addresses: Array<{ address: string }>;
    try {
        addresses = await lookup(host, { all: true });
    } catch {
        throw providerError("network", "cannot resolve host");
    }
    if (addresses.some((a) => isPrivateIp(a.address))) {
        throw providerError("bad-request", "refusing private/loopback target (SSRF guard); set ssrfGuard:false to allow");
    }
    return url;
}
