import type {
  ContextConfigDefault,
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { RouteGenericInterface } from "fastify/types/route";
import type { FastifySchema } from "fastify/types/schema";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

/**
 * TypeBox-typed Fastify instance. Every handler in the app is typed through
 * this provider so request bodies/params/queries are inferred from the route
 * schema and responses are serialized against it.
 */
export type FastifyTypeBox = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>;

/**
 * Request type for a handler registered with `schema: FooRoute`.
 *
 *   export async function handler(
 *     req: TypeBoxRequest<typeof FooRoute>,
 *     reply: TypeBoxReply<typeof FooRoute>,
 *   ) {}
 */
export type TypeBoxRequest<TSchema extends FastifySchema> = FastifyRequest<
  RouteGenericInterface,
  RawServerDefault,
  RawRequestDefaultExpression,
  TSchema,
  TypeBoxTypeProvider
>;

/** Reply counterpart of {@link TypeBoxRequest}. */
export type TypeBoxReply<TSchema extends FastifySchema> = FastifyReply<
  RouteGenericInterface,
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  ContextConfigDefault,
  TSchema,
  TypeBoxTypeProvider
>;
