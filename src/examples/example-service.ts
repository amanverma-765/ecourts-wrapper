/**
 * Example service showing the recommended pattern for eCourts API services.
 * This file is NOT imported anywhere — purely a developer reference.
 *
 * Pattern:
 *   1. Define a .proto service → run `pnpm generate`
 *   2. Implement the service handler using the generated types
 *   3. Register it in src/connect/router.ts
 *
 * Inside an RPC handler, use the eCourts framework:
 *   withToken → makeApiRequest → toConnectError
 */
import type {ConnectRouter} from "@connectrpc/connect";
import {z} from "zod";
import {Constants} from "../ecourts/constants.ts";
import {makeApiRequest} from "../ecourts/api-request.ts";
import {withToken} from "../ecourts/token-manager.ts";
import {toConnectError} from "../utils/error/connect-error.ts";
import {envContextKey} from "../connect/context.ts";

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

// 2. Zod schema for validating upstream eCourts response
const CaseDetailsSchema = z.object({
    status: z.string(),
    history: z.array(z.object({
        caseNumber: z.string(),
        title: z.string(),
        nextHearing: z.string().optional(),
    })).optional(),
    Msg: z.string().optional(),
    status_code: z.string().optional(),
});

// 3. Service registration — shows the full eCourts framework flow
export function registerCourtCaseService(router: ConnectRouter): void {
    // router.service(CourtCaseService, {
    //     async getCase(request, context) {
    //         const kv = context.values.get(envContextKey).ECOURTS_KV;
    //
    //         // Fetch token (cached or fresh), call upstream, retry once on 401/403
    //         const result = await withToken(kv, (token) =>
    //             makeApiRequest({
    //                 token,
    //                 baseUrl: Constants.BASE_URL_HC,
    //                 endpoint: "/caseHistoryWebService.php",
    //                 body: {
    //                     cino: request.cnr,
    //                     language_flag: "english",
    //                 },
    //                 schema: CaseDetailsSchema,
    //                 errorContext: "fetching case details",
    //             }, {
    //                 dataField: "history",
    //             })
    //         );
    //
    //         if (result.isErr()) throw toConnectError(result.error);
    //
    //         // Map validated data to protobuf response
    //         return {
    //             caseNumber: result.value.history?.[0]?.caseNumber ?? "",
    //             title: result.value.history?.[0]?.title ?? "",
    //             nextHearing: result.value.history?.[0]?.nextHearing ?? "",
    //         };
    //     },
    // });

    // Then add to src/connect/router.ts:
    //   import { registerCourtCaseService } from "../service/court-case.ts";
    //   registerCourtCaseService(router);

    void router;
}
