/**
 * Cloudflare Workers fetch() ↔ ConnectRPC universal handler adapter.
 *
 * Based on the official ConnectRPC Cloudflare Workers example pattern.
 * Uses universalServerRequestFromFetch/universalServerResponseToFetch
 * to bridge between CF Workers and ConnectRPC's universal handler types.
 *
 * @see https://github.com/connectrpc/examples-es/tree/main/cloudflare-workers
 */
import {
    cors,
    createConnectRouter,
    createContextValues,
    type ConnectRouter,
    type ConnectRouterOptions,
    type ContextValues,
} from "@connectrpc/connect";
import {
    universalServerRequestFromFetch,
    universalServerResponseToFetch,
    type UniversalHandler,
} from "@connectrpc/connect/protocol";

interface CorsOptions {
    origin: string;
    maxAge?: number;
}

interface WorkerHandlerOptions<Env> extends ConnectRouterOptions {
    routes: (router: ConnectRouter) => void;
    contextValues?: (req: Request, env: Env, ctx: ExecutionContext) => ContextValues;
    notFound?: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
    cors?: CorsOptions;
}

function buildCorsHeaders(options: CorsOptions): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": options.origin,
        "Access-Control-Allow-Methods": cors.allowedMethods.join(", "),
        "Access-Control-Allow-Headers": cors.allowedHeaders.join(", "),
        "Access-Control-Expose-Headers": cors.exposedHeaders.join(", "),
        "Access-Control-Max-Age": String(options.maxAge ?? 86400),
    };
}

/**
 * Creates a CF Workers fetch handler from ConnectRPC route definitions.
 */
export function createWorkerHandler<Env = unknown>(options: WorkerHandlerOptions<Env>) {
    const router = createConnectRouter(options);
    options.routes(router);

    const paths = new Map<string, UniversalHandler>();
    for (const handler of router.handlers) {
        paths.set(handler.requestPath, handler);
    }

    const corsHeaders = options.cors ? buildCorsHeaders(options.cors) : undefined;

    return {
        async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
            // Handle CORS preflight
            if (corsHeaders && req.method === "OPTIONS") {
                return new Response(null, { status: 204, headers: corsHeaders });
            }

            const url = new URL(req.url);
            const handler = paths.get(url.pathname);

            if (handler === undefined) {
                const notFoundRes = (await options.notFound?.(req, env, ctx))
                    ?? Response.json({ error: "Not Found", path: url.pathname }, { status: 404 });
                if (corsHeaders) {
                    for (const [k, v] of Object.entries(corsHeaders)) {
                        notFoundRes.headers.set(k, v);
                    }
                }
                return notFoundRes;
            }

            const uReq = {
                ...universalServerRequestFromFetch(req, {}),
                contextValues: options.contextValues?.(req, env, ctx) ?? createContextValues(),
            };
            const uRes = await handler(uReq);
            const response = universalServerResponseToFetch(uRes);

            if (corsHeaders) {
                for (const [k, v] of Object.entries(corsHeaders)) {
                    response.headers.set(k, v);
                }
            }

            return response;
        },
    };
}
