import type { ConnectRouter } from "@connectrpc/connect";
import { Health } from "../gen/health/v1/health_pb.ts";

export function registerHealthService(router: ConnectRouter): void {
    router.service(Health, {
        async check() {
            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
                version: "1.0.0",
            };
        },
    });
}
