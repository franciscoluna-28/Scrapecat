import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyError, FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { fastifyRequestContext } from "@fastify/request-context";
import { env } from "@/config/env";
import { sweepStaleJobScratch } from "@/repositories/archive-service";
import { shutdownJobQueue } from "@/shared/queue";

/**
 * Builds the Fastify instance and registers everything that is not a route:
 * plugins, hooks, error handling, CORS, rate limiting, and Swagger.
 */
export async function createServer(instance?: FastifyInstance) {
  const app =
    instance ??
    Fastify({
      logger: { level: env.LOG_LEVEL },
      // Reuse an inbound `x-request-id` when a proxy/client provides one, else
      // mint one. The id is echoed back and is the correlation key for logs.
      genReqId: () => randomUUID(),
      requestIdHeader: "x-request-id",
    });

  // AsyncLocalStorage-backed request context: makes `req.id` available to the
  // shared logger (and anything else) for the whole request lifecycle.
  await app.register(fastifyRequestContext, {
    defaultStoreValues: (req) => ({ reqId: req.id }),
  });

  // Echo the id so clients can quote it in bug reports.
  app.addHook("onRequest", (req, reply, done) => {
    reply.header("x-request-id", req.id);
    done();
  });

  // s3 mode treats local scratch as disposable: clear any dirs a crashed
  // worker left behind, and release queue resources on shutdown.
  await sweepStaleJobScratch();
  app.addHook("onClose", async () => {
    await shutdownJobQueue();
  });

  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: "Invalid request parameters" });
    }
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.message || "Internal Server Error",
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: "Not Found" });
  });

  await app.register(cors, {
    // A single origin, or several comma-separated ones from CORS_ORIGIN.
    origin: env.corsOrigins.length <= 1 ? env.corsOrigins[0] ?? false : env.corsOrigins,
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
