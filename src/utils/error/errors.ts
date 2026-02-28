/**
 * Application error hierarchy.
 */
export abstract class AppError extends Error {
    protected constructor(message?: string) {
        super(message || "");
        this.name = this.constructor.name;
    }
}

export class BadRequestError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class ForbiddenError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class NotFoundError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class TimeoutError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class RateLimitError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class ValidationError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class InternalServerError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(details?: string) {
        super(details);
    }
}
