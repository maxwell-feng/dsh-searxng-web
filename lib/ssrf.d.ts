/** Check if an IPv4 address is in loopback, private, link-local, or reserved ranges. */
export declare function isPrivateIPv4(ip: string): boolean;
/** Check if an IPv6 address is loopback, link-local, unique-local, or IPv4-mapped private. */
export declare function isPrivateIPv6(ip: string): boolean;
/** Check if an IP address string is private or reserved. */
export declare function isPrivateIp(ip: string): boolean;
/**
 * Validate a fetch target. Returns the parsed URL or throws providerError.
 * When guard is enabled:
 *  - Only http: and https: protocols are permitted.
 *  - Hostname is validated before request dispatch.
 *  - Rejects localhost, loopback, private, link-local, and reserved IP ranges.
 */
export declare function resolveFetchTarget(urlStr: string, guard: boolean): Promise<URL>;
