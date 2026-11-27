import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyError } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { fastifyRequestContext } from "@fastify/request-context";
import sensible from "@fastify/sensible";
import compress from "@fastify/compress";
import fastifySSE from "@fastify/sse";
import { env } from "@/shared/config/env";
import { shutdownJobs } from "@/shared/queue";
import type { FastifyTypeBox } from "@/shared/fastify";
import requestIdentity from "@/shared/plugins/request-identity";

/**
 * Builds the Fastify instance and registers everything that is not a route:
 * plugins, hooks, error handling, CORS, rate limiting, and Swagger.
 */
export async function createServer(
  instance?: FastifyTypeBox,
): Promise<FastifyTypeBox> {
  const app =
    instance ??
    Fastify({
      logger: { level: env.LOG_LEVEL },
      // Reuse an inbound `x-request-id` when a proxy/client provides one, else
      // mint one. The id is echoed back and is the correlation key for logs.
      genReqId: () => randomUUID(),
      requestIdHeader: "x-request-id",
    }).withTypeProvider<TypeBoxTypeProvider>();

  // AsyncLocalStorage-backed request context: makes `req.id` available to the
  // shared logger (and anything else) for the whole request lifecycle.
  await app.register(fastifyRequestContext, {
    defaultStoreValues: (req) => ({ reqId: req.id }),
  });

  // Reply helpers (`reply.notFound()`, `app.httpErrors`, ...) plus the shared
  // error constructors used by handlers and services.
  await app.register(sensible);

  // Response compression. SSE replies write to the raw response through
  // @fastify/sse, so they bypass this onSend hook.
  await app.register(compress, { global: true });

  // Per-visitor identity (decorator escapes via fastify-plugin so route plugins
  // can use it). SSE is provided by the official @fastify/sse plugin, which
  // writes the raw response and closes it when the handler resolves — no
  // manual hijack/heartbeat/header juggling.
  await app.register(requestIdentity);
  await app.register(fastifySSE, { heartbeatInterval: 15_000 });

  // Echo the id so clients can quote it in bug reports.
  app.addHook("onRequest", (req, reply, done) => {
    reply.header("x-request-id", req.id);
    done();
  });

  // Release job worker resources on shutdown.
  app.addHook("onClose", async () => {
    await shutdownJobs();
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: "Invalid request parameters" });
    }

    const statusCode =
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
        ? error.statusCode
        : 500;

    // Never leak internal error messages on 5xx; log them with the request id.
    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
      return reply.status(statusCode).send({ error: "Internal Server Error" });
    }

    return reply
      .status(statusCode)
      .send({ error: error.message || "Request failed" });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: "Not Found" });
  });

  await app.register(cors, {
    // A single origin, or several comma-separated ones from CORS_ORIGIN.
    origin:
      env.corsOrigins.length <= 1
        ? (env.corsOrigins[0] ?? false)
        : env.corsOrigins,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Scrapecat API",
        version: "v1",
        description: "Backend API for Scrapecat RAG chat over git history",
      },
    },
  });

  // The Swagger UI serves static assets from disk, which serverless runtimes
  // (Vercel) don't provide. The OpenAPI JSON is still published.
  if (!env.isVercel) {
    await app.register(swaggerUi, {
      routePrefix: "/docs",
    });
  }

  return app;
}
