// Extend the request-context store so `requestContext.get("reqId")` is typed.
// Registered by `@fastify/request-context` in `src/build-app.ts`.
import "@fastify/request-context";

declare module "@fastify/request-context" {
  interface RequestContextData {
    reqId: string;
  }
}