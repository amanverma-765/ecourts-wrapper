/**
 * Example route showing the recommended pattern for adding new endpoints.
 * This file is NOT imported anywhere — purely a developer reference.
 *
 * Pattern: zod schema -> HttpClient -> validateApiError -> Result<T, AppError> -> handleResult
 */
import {Hono} from "hono";
import {z} from "zod";
import {ok, err, type Result} from "neverthrow";
import type {AppEnv} from "../config/app-env.ts";
import {createHttpClient} from "../utils/http/http-client.ts";
import type {AppError} from "../utils/error/errors.ts";
import {InternalServerError} from "../utils/error/errors.ts";
import {handleResult} from "../utils/error/response-handler.ts";
import validateApiError from "../utils/api-validator.ts";

// 1. Define schemas for validation
const CourtCaseSchema = z.object({
    caseNumber: z.string(),
    title: z.string(),
    status: z.string(),
    nextHearing: z.string().optional(),
});

type CourtCase = z.infer<typeof CourtCaseSchema>;

// 2. Service function returns Result<T, AppError>
async function fetchCase(caseId: string, token: string): Promise<Result<CourtCase, AppError>> {
    const client = createHttpClient({
        defaultHeaders: {"Authorization": `Bearer ${token}`},
    });

    const response = await client.get(`https://api.ecourts.example/cases/${caseId}`);

    if (!response.ok) {
        return validateApiError(response, `Failed to fetch case ${caseId}`);
    }

    const data = await response.json();
    const parsed = CourtCaseSchema.safeParse(data);

    if (!parsed.success) {
        return err(new InternalServerError("Upstream response failed validation"));
    }

    return ok(parsed.data);
}

// 3. Route handler uses handleResult()
const exampleRoutes = new Hono<AppEnv>();

exampleRoutes.get("/cases/:id", async (c) => {
    const caseId = c.req.param("id");
    const token = c.req.header("x-token") ?? "";
    const result = await fetchCase(caseId, token);
    return handleResult(result);
});

// POST example with 201 status
exampleRoutes.post("/cases", async (c) => {
    const body = await c.req.json();
    // ... validate and create case ...
    return handleResult(ok(body), 201);
});

export default exampleRoutes;
