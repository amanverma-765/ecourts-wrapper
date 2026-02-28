import {type Result} from "neverthrow";
import {type AppError} from "./errors.ts";
import {error, success} from "./response.ts";
import logger from "../logger.ts";

export function handleResult<T>(result: Result<T, AppError>, successStatus = 200): Response {
    return result.match(
        (data) => {
            return new Response(
                JSON.stringify(success(data, successStatus)),
                {
                    status: successStatus,
                    headers: {"Content-Type": "application/json"},
                }
            );
        },
        (err) => {
            logger.error(`[${err.identifier}] ${err.message}`);
            const status = err.statusCode;
            return new Response(
                JSON.stringify(error(err.message, status, err.identifier)),
                {
                    status,
                    headers: {"Content-Type": "application/json"},
                }
            );
        }
    );
}
