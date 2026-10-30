import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { chatMessages, chatSessions, type ChatCitation } from "@/db/schema";

export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;

export function createChatStore(client: DbOrTx = db) {
  return {
    async createSession(input: {
      projectId: string;
      title: string;
      anonymousId: string;
    }): Promise<ChatSessionRow> {
      const [row] = await client
        .insert(chatSessions)
        .values(input)
        .returning();
      return row;
    },

    async listSessions(opts?: {
      projectId?: string;
      anonymousId?: string;
    }): Promise<ChatSessionRow[]> {
      const conditions: SQL[] = [];
      if (opts?.projectId) conditions.push(eq(chatSessions.projectId, opts.projectId));
      if (opts?.anonymousId) conditions.push(eq(chatSessions.anonymousId, opts.anonymousId));
      const base = client
        .select()
        .from(chatSessions)
        .orderBy(desc(chatSessions.updatedAt));
      return conditions.length > 0
        ? await base.where(and(...conditions))
        : await base;
    },

    async getSession(id: string): Promise<ChatSessionRow | null> {
      const [row] = await client
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, id))
        .limit(1);
      return row ?? null;
    },

    async touchSession(id: string): Promise<void> {
      await client
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, id));
    },

    async deleteSession(id: string): Promise<void> {
      await client.delete(chatSessions).where(eq(chatSessions.id, id));
    },

    async addMessage(input: {
      sessionId: string;
      role: "user" | "assistant";
      content: string;
      branch?: string | null;
      citations?: ChatCitation[];
    }): Promise<ChatMessageRow> {
      const [row] = await client
        .insert(chatMessages)
        .values({
          sessionId: input.sessionId,
          role: input.role,
          content: input.content,
          branch: input.branch ?? null,
          citations: input.citations ?? [],
        })
        .returning();
      return row;
    },

    async listMessages(sessionId: string): Promise<ChatMessageRow[]> {
      return await client
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt));
    },
  };
}

export const chatStore = createChatStore();
