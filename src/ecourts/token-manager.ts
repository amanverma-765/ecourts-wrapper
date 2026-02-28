import {ok, err, type Result} from "neverthrow";
import {getJwtToken} from "./auth.ts";
import {type AppError, UnauthorizedError, ForbiddenError, InternalServerError} from "../utils/error/errors.ts";
import logger from "../utils/logger.ts";

const TOKEN_KEY = "ecourts:jwt";
const TOKEN_TTL_SECONDS = 480; // 8 minutes (eCourts tokens ~10 min)

let _kv: KVNamespace | null = null;

export function initTokenManager(kv: KVNamespace): void {
    _kv = kv;
}

function getKv(): KVNamespace {
    if (!_kv) throw new InternalServerError("Token manager not initialized — call initTokenManager(kv) first");
    return _kv;
}

export async function getToken(): Promise<Result<string, AppError>> {
    const kv = getKv();
    const cached = await kv.get(TOKEN_KEY);
    if (cached) return ok(cached);

    logger.info("No cached token, fetching new JWT");
    return fetchAndCacheToken();
}

export function isAuthError(error: AppError): boolean {
    return error instanceof UnauthorizedError || error instanceof ForbiddenError;
}

export async function refreshToken(): Promise<Result<string, AppError>> {
    return fetchAndCacheToken();
}

async function fetchAndCacheToken(): Promise<Result<string, AppError>> {
    const kv = getKv();
    const result = await getJwtToken();
    if (result.isErr()) return err(result.error);

    await kv.put(TOKEN_KEY, result.value, {expirationTtl: TOKEN_TTL_SECONDS});
    logger.info("JWT token cached in KV");
    return ok(result.value);
}
