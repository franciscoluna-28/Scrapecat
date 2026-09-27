import { asc, desc, eq } from "drizzle-orm";
import { db, DbOrTx, isInMemoryMode } from "@/db/client";
import * as memory from "@/db/memory";
import { chatMessages, chatSessions, type ChatCitation } from "@/db/schema";

export async function createSession({
  projectId,
  title,
  anonymousId,
  tx,
}: {
  projectId: string;
  title: string;
  anonymousId: string;
  tx?: DbOrTx;
}) {
  if (isInMemoryMode) return memory.createSession({ projectId, title, anonymousId });
  const [row] = await (tx || db)
    .insert(chatSessions)
    .values({ projectId, title, anonymousId })
    .returning();
  return row;
}

export async function listSessions(opts?: { projectId?: string; anonymousId?: string; tx?: DbOrTx }) {
  if (isInMemoryMode) return memory.listSessions({ projectId: opts?.projectId, anonymousId: opts?.anonymousId });
  const client = opts?.tx || db;
  const base = client
    .select()
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt));
  if (opts?.projectId) {
    return base.where(eq(chatSessions.projectId, opts.projectId));
  }
  return base;
}

export async function getSession({ id, tx }: { id: string; tx?: DbOrTx }) {
  if (isInMemoryMode) return memory.getSession({ id });
  const [row] = await (tx || db)
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, id))
    .limit(1);
  return row ?? null;
}

export async function touchSession({ id, tx }: { id: string; tx?: DbOrTx }) {
  if (isInMemoryMode) return memory.touchSession({ id });
  await (tx || db)
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, id));
}

export async function deleteSession({ id, tx }: { id: string; tx?: DbOrTx }) {
  if (isInMemoryMode) return memory.deleteSession({ id });
  await (tx || db).delete(chatSessions).where(eq(chatSessions.id, id));
}

export async function addMessage({
  sessionId,
  role,
  content,
  branch,
  citations,
  tx,
}: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  branch?: string | null;
  citations?: ChatCitation[];
  tx?: DbOrTx;
}) {
  if (isInMemoryMode) {
    return memory.addMessage({ sessionId, role, content, branch, citations });
  }
  const [row] = await (tx || db)
    .insert(chatMessages)
    .values({
      sessionId,
      role,
      content,
      branch: branch ?? null,
      citations: citations ?? [],
    })
    .returning();
  return row;
}

export async function listMessages({ sessionId, tx }: { sessionId: string; tx?: DbOrTx }) {
  if (isInMemoryMode) return memory.listMessages({ sessionId });
  const client = tx || db;
  return client
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
}
