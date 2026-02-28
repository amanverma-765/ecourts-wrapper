import {ok, err, type Result} from "neverthrow";
import {decryptResponse, encryptRequest} from "./crypto.ts";
import {ecourtsClient} from "./client.ts";
import {Constants} from "./constants.ts";
import {type AppError, UnauthorizedError, ForbiddenError, InternalServerError, NotFoundError} from "../utils/error/errors.ts";
import {httpResponseToError} from "../utils/api-validator.ts";
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
    const result = await fetchJwtToken();
    if (result.isErr()) return err(result.error);

    await kv.put(TOKEN_KEY, result.value, {expirationTtl: TOKEN_TTL_SECONDS});
    logger.info("JWT token cached in KV");
    return ok(result.value);
}

async function fetchJwtToken(): Promise<Result<string, AppError>> {
    try {
        const body = {
            version: "3.0",
            uid: `${Constants.DEVICE_ID}:in.gov.ecourts.eCourtsServices`,
        };

        const encBodyResult = await encryptRequest(body, true);
        if (encBodyResult.isErr()) return err(encBodyResult.error);

        const response = await ecourtsClient.get(
            `${Constants.BASE_URL_HC}/appReleaseWebService.php?params=${encBodyResult.value}`,
        );

        if (!response.ok) {
            logger.error(`Auth API error: ${response.status} ${response.statusText}`);
            return httpResponseToError(response);
        }

        const responseText = await response.text();
        const trimmedText = responseText.trim();

        if (!trimmedText || trimmedText === "null") {
            return err(new NotFoundError("Empty response from auth endpoint"));
        }

        const decryptResult = await decryptResponse(responseText);
        if (decryptResult.isErr()) {
            return err(new InternalServerError(`Auth decryption failed: ${decryptResult.error.message}`));
        }

        const token = (decryptResult.value as {token?: string}).token;

        if (!token) {
            logger.warn("JWT token not found in response");
            return err(new UnauthorizedError("Failed to generate token, try again"));
        }

        logger.info("JWT token retrieved successfully");
        return ok(token);
    } catch (e: unknown) {
        logger.error("Failed to get auth token:", e);
        return err(new InternalServerError("Something went wrong"));
    }
}
