/**
 * Application error hierarchy.
 * Each subclass declares its own HTTP status code — no external mapper needed.
 */
export abstract class AppError extends Error {
    abstract readonly statusCode: number;

    protected constructor(public identifier: string, message?: string) {
        super(message || "");
        this.name = this.constructor.name;
    }
}

export class BadRequestError extends AppError {
    readonly statusCode = 400;
    constructor(details?: string) {
        super("BAD_REQUEST", details);
    }
}

export class UnauthorizedError extends AppError {
    readonly statusCode = 401;
    constructor(details?: string) {
        super("UNAUTHORIZED", details);
    }
}

export class ForbiddenError extends AppError {
    readonly statusCode = 403;
    constructor(details?: string) {
        super("FORBIDDEN", details);
    }
}

export class NotFoundError extends AppError {
    readonly statusCode = 404;
    constructor(details?: string) {
        super("NOT_FOUND", details);
    }
}

export class TimeoutError extends AppError {
    readonly statusCode = 408;
    constructor(details?: string) {
        super("TIMEOUT", details);
    }
}

export class ConflictError extends AppError {
    readonly statusCode = 409;
    constructor(details?: string) {
        super("CONFLICT", details);
    }
}

export class RateLimitError extends AppError {
    readonly statusCode = 429;
    constructor(details?: string) {
        super("RATE_LIMITED", details);
    }
}

export class InternalServerError extends AppError {
    readonly statusCode = 500;
    constructor(details?: string) {
        super("INTERNAL_SERVER_ERROR", details);
    }
}

export class ServiceUnavailableError extends AppError {
    readonly statusCode = 503;
    constructor(details?: string) {
        super("SERVICE_UNAVAILABLE", details);
    }
}
