import {ok, err, type Result} from "neverthrow";
import {getJwtToken} from "./auth.ts";
import {type AppError, UnauthorizedError, ForbiddenError} from "../utils/error/errors.ts";
import logger from "../utils/logger.ts";

const TOKEN_KEY = "ecourts:jwt";
const TOKEN_TTL_SECONDS = 480; // 8 minutes (eCourts tokens ~10 min)

/**
 * Get a token (cached or fresh), execute fn, and retry once on auth errors.
 */
export async function withToken<T>(
    kv: KVNamespace,
    fn: (token: string) => Promise<Result<T, AppError>>
): Promise<Result<T, AppError>> {
    const tokenResult = await getToken(kv);
    if (tokenResult.isErr()) return err(tokenResult.error);

    const result = await fn(tokenResult.value);

    if (result.isErr() && isAuthError(result.error)) {
        logger.warn("Auth error, refreshing token and retrying");
        const refreshResult = await fetchAndCacheToken(kv);
        if (refreshResult.isErr()) return err(refreshResult.error);
        return fn(refreshResult.value);
    }

    return result;
}

async function getToken(kv: KVNamespace): Promise<Result<string, AppError>> {
    const cached = await kv.get(TOKEN_KEY);
    if (cached) return ok(cached);

    logger.info("No cached token, fetching new JWT");
    return fetchAndCacheToken(kv);
}

function isAuthError(error: AppError): boolean {
    return error instanceof UnauthorizedError || error instanceof ForbiddenError;
}

async function fetchAndCacheToken(kv: KVNamespace): Promise<Result<string, AppError>> {
    const result = await getJwtToken();
    if (result.isErr()) return err(result.error);

    await kv.put(TOKEN_KEY, result.value, {expirationTtl: TOKEN_TTL_SECONDS});
    logger.info("JWT token cached in KV");
    return ok(result.value);
}
