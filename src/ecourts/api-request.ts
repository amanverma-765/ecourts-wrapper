import {type ZodType} from "zod";
import {err, ok, type Result} from "neverthrow";
import {decryptResponse, encryptRequest} from "./crypto.ts";
import {ecourtsClient} from "./client.ts";
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
 * Options for making an encrypted API request to eCourts backend.
 */
export interface ApiRequestOptions<T> {
    /** Authentication token */
    token: string;
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
    /** Custom handler for checking status === "N" response */
    handleStatusN?: (data: unknown, msg: string | undefined) => Result<never, AppError>;
    /** Whether to treat missing dataField as NotFoundError (default: true) */
    notFoundOnMissingData?: boolean;
}

/**
 * Low-level encrypted GET against the eCourts API.
 *
 * Handles: encrypt body → HTTP GET → check status → handle null → decrypt (with JSON fallback).
 * Returns the raw decrypted data as `unknown`.
 */
export async function makeEcourtsRequest(
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

/**
 * Make an encrypted API request to eCourts backend.
 *
 * Handles the complete request lifecycle:
 * 1. Encrypts request body and token
 * 2. Makes HTTP GET request with encrypted parameters
 * 3. Decrypts response
 * 4. Pre-validates response structure (auth errors, status N, missing data)
 * 5. Validates response against provided Zod schema
 */
export async function makeApiRequest<T>(
    options: ApiRequestOptions<T>,
    validationConfig: ResponseValidationConfig = {},
): Promise<Result<T, AppError>> {
    const {token, baseUrl, endpoint, body, schema, errorContext} = options;
    const {
        dataField,
        handleStatusN,
        notFoundOnMissingData = true,
    } = validationConfig;

    try {
        // Encrypt token → build Authorization header
        const encTokenResult = await encryptRequest(token);
        if (encTokenResult.isErr()) return err(encTokenResult.error);

        const result = await makeEcourtsRequest(
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

            if (handleStatusN) {
                return handleStatusN(rawData, msg);
            }

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
    } catch (e: unknown) {
        logger.error(`Failed while ${errorContext}:`, e);
        if (e instanceof DOMException && e.name === "AbortError") {
            return err(new InternalServerError("Request timed out — the eCourts server is slow, please try again"));
        }
        return err(new InternalServerError("Something went wrong"));
    }
}
