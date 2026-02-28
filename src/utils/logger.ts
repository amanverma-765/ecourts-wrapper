/**
 * Lightweight logger compatible with Cloudflare Workers runtime.
 * console.* output goes to Workers Logs / `wrangler tail`.
 */
const logger = {
    debug: (...args: unknown[]): void => console.debug("[DEBUG]", ...args),
    info: (...args: unknown[]): void => console.info("[INFO]", ...args),
    warn: (...args: unknown[]): void => console.warn("[WARN]", ...args),
    error: (...args: unknown[]): void => console.error("[ERROR]", ...args),
};

export default logger;
