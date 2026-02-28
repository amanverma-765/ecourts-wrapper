/**
 * Example service showing the recommended pattern for adding new ConnectRPC services.
 * This file is NOT imported anywhere — purely a developer reference.
 *
 * Pattern:
 *   1. Define a .proto service → run `pnpm generate`
 *   2. Implement the service handler using the generated types
 *   3. Register it in src/connect/router.ts
 *
 * Inside an RPC handler you can use HttpClient + neverthrow + validateApiError
 * to call upstream APIs with typed error handling.
 */
import type { ConnectRouter } from "@connectrpc/connect";
import { z } from "zod";
import { ok, err, type Result } from "neverthrow";
import { createHttpClient } from "../utils/http/http-client.ts";
import type { AppError } from "../utils/error/errors.ts";
import { InternalServerError } from "../utils/error/errors.ts";
import { toConnectError } from "../utils/error/connect-error.ts";
import { envContextKey } from "../connect/context.ts";
import validateApiError from "../utils/api-validator.ts";

// ──────────────────────────────────────────────
// 1. Generated code (from .proto via `pnpm generate`)
//
//    Assume proto/courts/v1/courts.proto defines:
//
//    service CourtCaseService {
//      rpc GetCase(GetCaseRequest) returns (GetCaseResponse);
//    }
//
//    After generation you'd import:
//    import { CourtCaseService } from "../gen/courts/v1/courts_pb.ts";
// ──────────────────────────────────────────────

// 2. Zod schema for validating upstream responses
const CourtCaseSchema = z.object({
    caseNumber: z.string(),
    title: z.string(),
    status: z.string(),
    nextHearing: z.string().optional(),
});

type CourtCase = z.infer<typeof CourtCaseSchema>;

// 3. Service function — calls upstream eCourts API, returns Result<T, AppError>
async function fetchCase(caseId: string, token: string): Promise<Result<CourtCase, AppError>> {
    const client = createHttpClient({
        defaultHeaders: { "Authorization": `Bearer ${token}` },
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

// 4. Register the service on the ConnectRouter
//    In a real service, you'd use the generated service descriptor.
//    This shows how the handler calls the service function and maps errors.
export function registerCourtCaseService(router: ConnectRouter): void {
    // router.service(CourtCaseService, {
    //     async getCase(request, context) {
    //         const env = context.values.get(envContextKey);
    //         const token = context.requestHeader.get("authorization") ?? "";
    //         const result = await fetchCase(request.caseId, token);
    //
    //         if (result.isErr()) {
    //             throw toConnectError(result.error);
    //         }
    //
    //         const caseData = result.value;
    //         return {
    //             caseNumber: caseData.caseNumber,
    //             title: caseData.title,
    //             status: caseData.status,
    //             nextHearing: caseData.nextHearing ?? "",
    //         };
    //     },
    // });

    // Then add to src/connect/router.ts:
    //   import { registerCourtCaseService } from "../service/court-case.ts";
    //   registerCourtCaseService(router);

    void router;
    void fetchCase;
}
