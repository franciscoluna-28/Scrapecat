import { FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import {
  CreateSessionBody,
  ChatSessionsQuery,
  ChatSessionIdParams,
  SendMessageBody,
} from "@/chat/schemas";
import {
  createChatSession,
  listChatSessions,
  getChatMessages,
  deleteChatSession,
  streamChatMessage,
  SessionNotFoundError,
} from "@/chat/services";
import * as chatSessionsStore from "@/chat/stores/chat-sessions-store";
import { env } from "@/config/env";

function getAnonymousId(req: FastifyRequest): string {
  return (req.headers["x-anonymous-id"] as string) || "anonymous";
}

export async function createSession(req: FastifyRequest, reply: FastifyReply) {
  const { projectId } = req.body as Static<typeof CreateSessionBody>;
  const anonymousId = getAnonymousId(req);
  try {
    const session = await createChatSession(projectId, anonymousId);
    return reply.status(201).send(session);
  } catch (error) {
    const message = (error as Error)?.message ?? "Failed to create chat session";
    const status = message === "Project not found" ? 404 : 500;
    return reply.status(status).send({ error: message });
  }
}

export async function listSessions(req: FastifyRequest, reply: FastifyReply) {
  const { projectId } = req.query as Static<typeof ChatSessionsQuery>;
  const anonymousId = getAnonymousId(req);
  try {
    const sessions = await listChatSessions(projectId, anonymousId);
    return reply.send({ sessions });
  } catch {
    return reply.status(500).send({ error: "Failed to list chat sessions" });
  }
}

export async function getMessages(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ChatSessionIdParams>;
  const anonymousId = getAnonymousId(req);
  try {
    const messages = await getChatMessages(id);
    if (!messages) {
      return reply.status(404).send({ error: "Chat session not found" });
    }
    return reply.send({ messages });
  } catch {
    return reply.status(500).send({ error: "Failed to list chat messages" });
  }
}

export async function removeSession(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ChatSessionIdParams>;
  const anonymousId = getAnonymousId(req);
  try {
    const session = await chatSessionsStore.getSession({ id });
    if (!session) {
      return reply.status(404).send({ error: "Chat session not found" });
    }
    if (session.anonymousId && session.anonymousId !== anonymousId) {
      return reply.status(403).send({ error: "Access denied" });
    }
    const deleted = await deleteChatSession(id);
    if (!deleted) {
      return reply.status(404).send({ error: "Chat session not found" });
    }
    return reply.send({ deleted: true });
  } catch {
    return reply.status(500).send({ error: "Failed to delete chat session" });
  }
}

/**
 * SSE stream of an assistant reply. Frames:
 *  - { type: "token", content }   per delta
 *  - { type: "done", message }    final assistant message incl. citations
 *  - { type: "error", error }     on failure after the stream started
 */
export async function streamMessage(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as Static<typeof ChatSessionIdParams>;
  const { content, branch, model, provider } = req.body as Static<typeof SendMessageBody>;
  const anonymousId = getAnonymousId(req);

  const session = await chatSessionsStore.getSession({ id });
  if (!session) {
    return reply.status(404).send({ error: "Chat session not found" });
  }
  if (session.anonymousId && session.anonymousId !== anonymousId) {
    return reply.status(403).send({ error: "Access denied" });
  }

  reply.hijack();
  const res = reply.raw;

  // @fastify/cors headers are discarded after hijack — reflect origin inline.
  const origin = req.raw.headers.origin;
  if (origin) {
    const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
    if (allowed.includes("*") || allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    res.end();
  };
  req.raw.on("close", close);

  const send = (data: unknown) => {
    if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const message = await streamChatMessage({
      sessionId: id,
      content,
      branch,
      model,
      provider,
      onProgress: (stage, msg, done, total) => {
        send({ type: "progress", stage, message: msg, done, total });
      },
      onToken: (chunk) => {
        send({ type: "token", content: chunk });
      },
    });
    send({ type: "done", message });
  } catch (error) {
    const message =
      error instanceof SessionNotFoundError
        ? "Chat session not found"
        : (error as Error)?.message ?? "Failed to generate reply";
    send({ type: "error", error: message });
  } finally {
    close();
  }
}
