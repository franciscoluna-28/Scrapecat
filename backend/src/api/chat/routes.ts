import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { preHandlerHookHandler } from "fastify";
import type { TypeBoxReply, TypeBoxRequest } from "@/shared/fastify";
import { httpErrors } from "@/shared/errors";
import { env } from "@/shared/config/env";
import { chatService, SessionNotFoundError } from "@/api/chat/services";
import { chatStore } from "@/api/chat/chat-store";
import {
  CreateSessionRoute,
  DeleteChatSessionRoute,
  GetChatMessagesRoute,
  ListChatSessionsRoute,
  SendChatMessageRoute,
} from "@/api/chat/schemas";

function canAccessSession(
  session: { anonymousId: string | null },
  anonymousId: string,
): boolean {
  return !!session.anonymousId && session.anonymousId === anonymousId;
}

/**
 * Ensures the session exists and belongs to this visitor before read/stream/
 * delete runs. Returns 404 for someone else's session so existence is not
 * leaked.
 */
const requireChatSession: preHandlerHookHandler = async (request) => {
  const id = (request.params as { id?: string }).id;
  const session = id ? await chatStore.getSession(id) : null;
  if (!session || !canAccessSession(session, request.anonymousId)) {
    throw httpErrors.notFound("Chat session not found");
  }
};

export async function createSession(
  req: TypeBoxRequest<typeof CreateSessionRoute>,
  reply: TypeBoxReply<typeof CreateSessionRoute>,
) {
  const session = await chatService.createSession(
    req.body.projectId,
    req.anonymousId,
  );
  reply.code(201);
  return session;
}

export async function listSessions(
  req: TypeBoxRequest<typeof ListChatSessionsRoute>,
  _reply: TypeBoxReply<typeof ListChatSessionsRoute>,
) {
  return {
    sessions: await chatService.listSessions(
      req.query.projectId,
      req.anonymousId,
    ),
  };
}

export async function getMessages(
  req: TypeBoxRequest<typeof GetChatMessagesRoute>,
  _reply: TypeBoxReply<typeof GetChatMessagesRoute>,
) {
  const messages = await chatService.getMessages(req.params.id);
  if (!messages) throw httpErrors.notFound("Chat session not found");
  return { messages };
}

export async function removeSession(
  req: TypeBoxRequest<typeof DeleteChatSessionRoute>,
  _reply: TypeBoxReply<typeof DeleteChatSessionRoute>,
) {
  const deleted = await chatService.deleteSession(req.params.id);
  if (!deleted) throw httpErrors.notFound("Chat session not found");
  return { deleted: true };
}

/**
 * SSE stream of an assistant reply. Frames:
 *  - { type: "token", content }   per delta
 *  - { type: "done", message }    final assistant message incl. citations
 *  - { type: "error", error }     on failure after the stream started
 */
export async function streamMessage(
  req: TypeBoxRequest<typeof SendChatMessageRoute>,
  reply: TypeBoxReply<typeof SendChatMessageRoute>,
) {
  const { content, branch, model, provider, persona, clientMessageId } =
    req.body;

  // Abort upstream work when the client disconnects. `@fastify/sse` also fires
  // this when the handler resolves, which is a harmless no-op by then.
  const abort = new AbortController();
  reply.sse.onClose(() => abort.abort());

  // `chatService` emits tokens synchronously; serialize writes so ordering and
  // backpressure are preserved across the SSE frames.
  let writes = Promise.resolve();
  const send = (data: unknown) => {
    writes = writes
      .then(() => reply.sse.send({ data }))
      .catch(() => {
        // The connection closed mid-stream; nothing left to deliver.
      });
    return writes;
  };

  // Preserve the reconnection hint sent before the first token.
  writes = writes
    .then(() => reply.sse.send({ data: undefined, retry: 3000 }))
    .catch(() => {});

  try {
    const message = await chatService.streamMessage({
      sessionId: req.params.id,
      content,
      branch,
      model,
      provider,
      persona,
      clientMessageId,
      signal: abort.signal,
      onProgress: (stage, msg, done, total) => {
        void send({ type: "progress", stage, message: msg, done, total });
      },
      onToken: (chunk) => {
        void send({ type: "token", content: chunk });
      },
    });
    await send({ type: "done", message });
  } catch (error) {
    const message =
      error instanceof SessionNotFoundError
        ? "Chat session not found"
        : ((error as Error)?.message ?? "Failed to generate reply");
    await send({ type: "error", error: message, requestId: req.id });
  }
  // No explicit close: @fastify/sse ends the raw response when the handler
  // resolves (and Fastify skips its own send because reply.sent is true).
}

export const chatRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post("/chat/sessions", { schema: CreateSessionRoute }, createSession);

  app.get("/chat/sessions", { schema: ListChatSessionsRoute }, listSessions);

  app.get(
    "/chat/sessions/:id/messages",
    { schema: GetChatMessagesRoute, preHandler: requireChatSession },
    getMessages,
  );

  app.delete(
    "/chat/sessions/:id",
    { schema: DeleteChatSessionRoute, preHandler: requireChatSession },
    removeSession,
  );

  app.post(
    "/chat/sessions/:id/messages",
    {
      schema: SendChatMessageRoute,
      preHandler: requireChatSession,
      // `manual` = no Accept negotiation; this endpoint always streams and the
      // handler decides via reply.sse.*. Keeps our `{ error }` contract.
      sse: "manual",
      config: {
        rateLimit: {
          max: env.CHAT_RATE_LIMIT_MAX,
          timeWindow: "1 minute",
        },
      },
    },
    streamMessage,
  );
};
