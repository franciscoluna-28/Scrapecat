import { pino } from "pino";
import { requestContext } from "@fastify/request-context";
import { env } from "@/config/env";

export const logger = pino({
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  level: env.LOG_LEVEL ?? "info",
  // Tag every line with the current request id (when inside a request) so an
  // ingestion job, SSE stream, or provider error can be traced back to its
  // originating HTTP call. `@fastify/request-context` populates the store on
  // `onRequest`; outside a request this contributes nothing.
  mixin() {
    const reqId = requestContext.get("reqId");
    return reqId ? { reqId } : {};
  },
});
