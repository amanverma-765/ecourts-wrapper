import type { ConnectRouter } from "@connectrpc/connect";
import { registerHealthService } from "../service/health.ts";

export function configureRoutes(router: ConnectRouter): void {
    registerHealthService(router);
}
