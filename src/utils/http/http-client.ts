import {CookieJar} from "./cookie-jar.ts";

export interface HttpClientOptions {
    defaultHeaders?: Record<string, string>;
    /** Request timeout in milliseconds. Defaults to 10000 (10s). */
    timeoutMs?: number;
}

interface JsonBody {
    [key: string]: unknown;
}

export function createHttpClient(options?: HttpClientOptions): HttpClient {
    return new HttpClient(options);
}

export class HttpClient {
    private cookieJar: CookieJar;
    private readonly defaultHeaders: Record<string, string>;
    private readonly timeoutMs: number;

    constructor(options?: HttpClientOptions) {
        this.cookieJar = new CookieJar();
        this.defaultHeaders = options?.defaultHeaders ?? {};
        this.timeoutMs = options?.timeoutMs ?? 10_000;
    }

    async request(url: string, options: RequestInit = {}, customHeaders?: Record<string, string>): Promise<Response> {
        const headers = new Headers(options.headers);

        for (const [key, value] of Object.entries(this.defaultHeaders)) {
            headers.set(key, value);
        }

        if (customHeaders) {
            for (const [key, value] of Object.entries(customHeaders)) {
                headers.set(key, value);
            }
        }

        const cookieHeader = this.cookieJar.getCookieHeader();
        if (cookieHeader) {
            headers.set("Cookie", cookieHeader);
        }

        // Use caller-provided signal if present, otherwise apply default timeout
        const signal = options.signal ?? AbortSignal.timeout(this.timeoutMs);

        const res = await fetch(url, {...options, headers, signal});

        const setCookie = res.headers.get("Set-Cookie");
        if (setCookie) this.cookieJar.setCookies(setCookie);

        return res;
    }

    async get(url: string, headers?: Record<string, string>): Promise<Response> {
        return this.request(url, {method: "GET"}, headers);
    }

    async post(url: string, body: JsonBody, headers?: Record<string, string>): Promise<Response> {
        return this.request(
            url,
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
            },
            headers
        );
    }

    async submitForm(url: string, formData: Record<string, string>, headers?: Record<string, string>): Promise<Response> {
        const body = new URLSearchParams(formData).toString();
        return this.request(
            url,
            {
                method: "POST",
                headers: {"Content-Type": "application/x-www-form-urlencoded"},
                body,
            },
            headers
        );
    }
}
