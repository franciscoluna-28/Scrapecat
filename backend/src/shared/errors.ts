import { httpErrors } from "@fastify/sensible";

/**
 * Framework-neutral HTTP error constructors (http-errors). Handlers and
 * services throw these; the global error handler in `create-server.ts` maps
 * `statusCode` to the shared `{ error: string }` body and logs 5xx responses.
 */
export { httpErrors };
