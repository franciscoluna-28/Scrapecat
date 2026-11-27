import fp from "fastify-plugin";

const ANONYMOUS_ID_MAX_LENGTH = 128;

declare module "fastify" {
  interface FastifyRequest {
    /** Visitor id from `x-anonymous-id`, trimmed/capped, never empty. */
    anonymousId: string;
  }
}

function parseAnonymousId(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, ANONYMOUS_ID_MAX_LENGTH) || "anonymous";
}

/**
 * Resolves the per-visitor identity once per request. Wrapped in fastify-plugin
 * so the decorator/hook escape this module's scope and are available to every
 * route plugin registered afterwards.
 */
export default fp(async (app) => {
  app.decorateRequest("anonymousId", "anonymous");
  app.addHook("onRequest", async (request) => {
    request.anonymousId = parseAnonymousId(
      request.raw.headers["x-anonymous-id"],
    );
  });
});
