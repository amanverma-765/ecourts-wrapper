/**
 * Main entry point for the Cloudflare Worker.
 */
import { createContextValues } from "@connectrpc/connect";
import { createWorkerHandler } from "./connect/adapter.ts";
import { envContextKey, executionContextKey, requestContextKey } from "./connect/context.ts";
import { configureRoutes } from "./connect/router.ts";
import { initTokenManager } from "./ecourts/token-manager.ts";

export default createWorkerHandler<CloudflareBindings>({
    routes: configureRoutes,
    cors: { origin: "*" },
    contextValues(req, env, ctx) {
        initTokenManager(env.ECOURTS_KV);
        return createContextValues()
            .set(envContextKey, env)
            .set(requestContextKey, req)
            .set(executionContextKey, ctx);
    },
});
