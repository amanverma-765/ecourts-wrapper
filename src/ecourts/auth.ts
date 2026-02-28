import {ok, err, type Result} from "neverthrow";
import {Constants} from "./constants.ts";
import {makeEcourtsRequest} from "./api-request.ts";
import type {AppError} from "../utils/error/errors.ts";
import {InternalServerError, UnauthorizedError} from "../utils/error/errors.ts";
import logger from "../utils/logger.ts";

export async function getJwtToken(): Promise<Result<string, AppError>> {
    try {
        const body = {
            version: "3.0",
            uid: `${Constants.DEVICE_ID}:in.gov.ecourts.eCourtsServices`,
        };

        const result = await makeEcourtsRequest(
            `${Constants.BASE_URL_HC}/appReleaseWebService.php`,
            body,
            undefined,
            "fetching auth token",
        );
        if (result.isErr()) return err(result.error);

        const token = (result.value as {token?: string}).token;

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
