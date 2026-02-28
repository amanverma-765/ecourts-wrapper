export type SuccessResponse<T = unknown> = {
    success: true;
    status: number;
    timestamp: number;
    data: T;
};

export type ErrorResponse = {
    success: false;
    status: number;
    timestamp: number;
    message: string;
    error: string;
};

export function success<T>(data: T, status = 200): SuccessResponse<T> {
    return {
        success: true,
        status,
        timestamp: Date.now(),
        data,
    };
}

export function error(message: string, status: number, error: string): ErrorResponse {
    return {
        success: false,
        status,
        timestamp: Date.now(),
        message,
        error,
    };
}
