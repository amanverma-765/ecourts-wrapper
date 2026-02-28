/**
 * Typed context keys for passing Cloudflare Worker environment
 * into ConnectRPC service handlers via context values.
 *
 * Usage in a service handler:
 *   const env = context.values.get(envContextKey);
 *   const request = context.values.get(requestContextKey);
 */
import { createContextKey, type ContextKey } from "@connectrpc/connect";

/** Cloudflare Worker environment bindings (secrets, KV, D1, etc.) */
export const envContextKey: ContextKey<CloudflareBindings> =
    createContextKey<CloudflareBindings>(undefined as unknown as CloudflareBindings);

/** The original incoming Request object */
export const requestContextKey: ContextKey<Request> =
    createContextKey<Request>(undefined as unknown as Request);

/** Cloudflare ExecutionContext for waitUntil() and passThroughOnException() */
export const executionContextKey: ContextKey<ExecutionContext> =
    createContextKey<ExecutionContext>(undefined as unknown as ExecutionContext);
