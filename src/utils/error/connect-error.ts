/**
 * AppError -> ConnectError bridge.
 * Maps the application error hierarchy to gRPC-style status codes.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import {
    type AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    UnauthorizedError,
} from "./errors.ts";

const statusToCode: ReadonlyArray<[new (...args: never[]) => AppError, Code]> = [
    [BadRequestError, Code.InvalidArgument],
    [UnauthorizedError, Code.Unauthenticated],
    [ForbiddenError, Code.PermissionDenied],
    [NotFoundError, Code.NotFound],
    [TimeoutError, Code.DeadlineExceeded],
    [ConflictError, Code.AlreadyExists],
    [RateLimitError, Code.ResourceExhausted],
    [InternalServerError, Code.Internal],
    [ServiceUnavailableError, Code.Unavailable],
];

/**
 * Converts an AppError to a ConnectError with the appropriate gRPC status code.
 * The original error is preserved as `cause` for debugging.
 */
export function toConnectError(error: AppError): ConnectError {
    for (const [ErrorClass, code] of statusToCode) {
        if (error instanceof ErrorClass) {
            return new ConnectError(error.message || error.identifier, code, undefined, undefined, error);
        }
    }
    return new ConnectError(error.message || error.identifier, Code.Internal, undefined, undefined, error);
}
