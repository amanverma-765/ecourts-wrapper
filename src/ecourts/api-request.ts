import {type ZodType} from "zod";
import {err, ok, type Result} from "neverthrow";
import {decryptResponse, encryptRequest} from "./crypto.ts";
import {ecourtsClient} from "./client.ts";
import {getToken, isAuthError, refreshToken} from "./token-manager.ts";
import {
    type AppError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
} from "../utils/error/errors.ts";
import {httpResponseToError} from "../utils/api-validator.ts";
import logger from "../utils/logger.ts";

/**
 * Options for making an eCourts API request.
 */
export interface EcourtsRequestOptions<T> {
    /** Base URL for the API endpoint */
    baseUrl: string;
    /** API endpoint path (e.g., "/caseHistoryWebService.php") */
    endpoint: string;
    /** Request body parameters (will be encrypted) */
    body: Record<string, unknown>;
    /** Zod schema for validating the response */
    schema: ZodType<T>;
    /** Context message for error logging */
    errorContext: string;
}

/**
 * Configuration for validating API response structure.
 */
export interface ResponseValidationConfig {
    /** Field that must be present for a successful response (e.g., "history", "states") */
    dataField?: string;
    /** Whether to treat missing dataField as NotFoundError (default: true) */
    notFoundOnMissingData?: boolean;
}

/**
 * Make an authenticated, encrypted request to the eCourts API.
 *
 * Handles the complete lifecycle:
 * 1. Fetches token from KV cache (or gets a fresh one)
 * 2. Encrypts request body and token
 * 3. Makes HTTP GET request with encrypted parameters
 * 4. Decrypts response (handles both encrypted and plain JSON)
 * 5. Pre-validates response structure (auth errors, status N, missing data)
 * 6. Validates response against provided Zod schema
 * 7. Retries once with a fresh token on auth errors
 */
export async function makeEcourtsRequest<T>(
    options: EcourtsRequestOptions<T>,
    validationConfig: ResponseValidationConfig = {},
): Promise<Result<T, AppError>> {
    const {baseUrl, endpoint, body, schema, errorContext} = options;
    const {
        dataField,
        notFoundOnMissingData = true,
    } = validationConfig;

    const attempt = async (token: string): Promise<Result<T, AppError>> => {
        // Encrypt token → build Authorization header
        const encTokenResult = await encryptRequest(token);
        if (encTokenResult.isErr()) return err(encTokenResult.error);

        const result = await rawEncryptedGet(
            `${baseUrl}${endpoint}`,
            body,
            {"Authorization": `Bearer ${encTokenResult.value}`},
            errorContext,
        );
        if (result.isErr()) return err(result.error);

        const rawData = result.value as Record<string, unknown>;

        // Pre-validation: check for authentication errors
        const statusCode = rawData["status_code"] as string | undefined;
        if (statusCode === "401" || statusCode === "403") {
            logger.error("Unauthorized access:", rawData["Msg"]);
            return err(new UnauthorizedError("Unauthorized API request"));
        }

        // Pre-validation: check for status === "N" (explicit failure)
        if (rawData["status"] === "N") {
            const msg = rawData["Msg"] as string | undefined;
            return err(new NotFoundError(msg || `No data found for ${errorContext}`));
        }

        // Pre-validation: check for missing required data field
        if (dataField && !rawData[dataField]) {
            const msg = rawData["Msg"] as string | undefined;

            if (notFoundOnMissingData) {
                return err(new NotFoundError(msg || `No ${dataField} found`));
            }

            return err(new BadRequestError(msg || "Unknown error from API"));
        }

        // Validate against Zod schema
        const parsedResponse = schema.safeParse(rawData);
        if (!parsedResponse.success) {
            logger.error("Validation error:", parsedResponse.error);
            return err(new ValidationError(`Failed to parse response for ${errorContext}`));
        }

        return ok(parsedResponse.data);
    };

    try {
        const tokenResult = await getToken();
        if (tokenResult.isErr()) return err(tokenResult.error);

        const result = await attempt(tokenResult.value);

        // Retry once on auth error with a fresh token
        if (result.isErr() && isAuthError(result.error)) {
            logger.warn("Auth error, refreshing token and retrying");
            const freshToken = await refreshToken();
            if (freshToken.isErr()) return err(freshToken.error);
            return attempt(freshToken.value);
        }

        return result;
    } catch (e: unknown) {
        logger.error(`Failed while ${errorContext}:`, e);
        if (e instanceof DOMException && e.name === "AbortError") {
            return err(new InternalServerError("Request timed out — the eCourts server is slow, please try again"));
        }
        return err(new InternalServerError("Something went wrong"));
    }
}

/**
 * Low-level encrypted GET against the eCourts API.
 * Not exported — used internally by makeEcourtsRequest and token-manager.
 */
async function rawEncryptedGet(
    url: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>,
    errorContext: string = "eCourts request",
): Promise<Result<unknown, AppError>> {
    const encBodyResult = await encryptRequest(body, true);
    if (encBodyResult.isErr()) return err(encBodyResult.error);

    const response = await ecourtsClient.get(
        `${url}?params=${encBodyResult.value}`,
        headers,
    );

    if (!response.ok) {
        logger.error(`API error while ${errorContext}: ${response.status} ${response.statusText}`);
        return httpResponseToError(response);
    }

    const responseText = await response.text();
    const trimmedText = responseText.trim();

    if (!trimmedText || trimmedText === "null") {
        logger.warn(`Empty/null response while ${errorContext}. Raw: "${responseText.slice(0, 100)}"`);
        return err(new NotFoundError(`No data found for ${errorContext}`));
    }

    const decryptResult = await decryptResponse(responseText);
    if (decryptResult.isErr()) {
        logger.error(
            `Decryption failed while ${errorContext}. Raw response (first 500 chars):`,
            responseText.slice(0, 500),
        );

        // Try to extract info from raw response as plain JSON
        try {
            const plain = JSON.parse(trimmedText);
            if (plain && typeof plain === "object") {
                const msg = (plain["Msg"] ?? plain["message"] ?? plain["error"]) as string | undefined;

                if (plain["status"] === "N" || plain["status"] === "error") {
                    return err(new NotFoundError(msg || `No data found for ${errorContext}`));
                }
                if (msg) {
                    return err(new InternalServerError(msg));
                }
            }
        } catch {
            // Not valid JSON either — fall through
        }

        return err(new InternalServerError(
            `Decryption failed: ${decryptResult.error.message}`,
        ));
    }

    logger.info(`Successfully completed ${errorContext}`);
    return ok(decryptResult.value);
}
