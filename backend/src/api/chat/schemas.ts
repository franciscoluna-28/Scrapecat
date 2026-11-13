import { Type, type Static } from "@sinclair/typebox";
import { BRANCH_PATTERN } from "@/shared/utils";

const ChatCitation = Type.Object({
  commitSha: Type.String(),
  commitMessage: Type.String(),
  author: Type.Union([Type.String(), Type.Null()]),
  committedAt: Type.String(),
  filesChanged: Type.Array(Type.String()),
  commitUrl: Type.Union([Type.String(), Type.Null()]),
});

const ChatSessionResponse = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  title: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

const ChatMessageResponse = Type.Object({
  id: Type.String(),
  role: Type.Union([Type.Literal("user"), Type.Literal("assistant")]),
  content: Type.String(),
  branch: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  citations: Type.Array(ChatCitation),
  createdAt: Type.String({ format: "date-time" }),
});

export const CreateSessionBody = Type.Object({
  projectId: Type.String({ format: "uuid" }),
});

export const CreateSessionResponse = ChatSessionResponse;

export const ChatSessionsQuery = Type.Object({
  projectId: Type.Optional(Type.String({ format: "uuid" })),
});

export const ChatSessionsListResponse = Type.Object({
  sessions: Type.Array(ChatSessionResponse),
});

export const ChatSessionIdParams = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const ChatMessagesResponse = Type.Object({
  messages: Type.Array(ChatMessageResponse),
});

export const SendMessageBody = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 10000 }),
  branch: Type.Optional(
    Type.String({ minLength: 1, maxLength: 200, pattern: BRANCH_PATTERN }),
  ),
  model: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  provider: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  persona: Type.Optional(
    Type.Union([Type.Literal("founder"), Type.Literal("cto"), Type.Literal("engineer")]),
  ),
  // Client-generated id for this logical send. Retries reuse it so the server
  // can replay the stored turn instead of creating a duplicate.
  clientMessageId: Type.Optional(Type.String({ format: "uuid" })),
});

export const DeleteSessionResponse = Type.Object({
  deleted: Type.Boolean(),
});

export type ChatCitationDTO = Static<typeof ChatCitation>;
export type ChatMessageDTO = Static<typeof ChatMessageResponse>;
