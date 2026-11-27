import { Type, type Static } from "@sinclair/typebox";
import type { FastifySchema } from "fastify";
import { ErrorResponse } from "@/shared/typebox";
import { BRANCH_PATTERN } from "@/shared/utils";

/** Visitor id header, validated when present and ignored when absent. */
export const AnonymousIdHeaders = Type.Object(
  {
    "x-anonymous-id": Type.Optional(
      Type.String({ minLength: 1, maxLength: 128 }),
    ),
  },
  { additionalProperties: true },
);

const ChatCitation = Type.Object({
  commitSha: Type.String(),
  commitMessage: Type.String(),
  summary: Type.Optional(Type.String()),
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

export const CreateSessionRoute = {
  description: "Create a new chat session for a project",
  tags: ["chat"],
  headers: AnonymousIdHeaders,
  body: CreateSessionBody,
  response: {
    201: CreateSessionResponse,
    400: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
} satisfies FastifySchema;

export const ListChatSessionsRoute = {
  description: "List chat sessions, optionally filtered by project",
  tags: ["chat"],
  headers: AnonymousIdHeaders,
  querystring: ChatSessionsQuery,
  response: {
    200: ChatSessionsListResponse,
    400: ErrorResponse,
    500: ErrorResponse,
  },
} satisfies FastifySchema;

export const GetChatMessagesRoute = {
  description: "List messages for a chat session",
  tags: ["chat"],
  headers: AnonymousIdHeaders,
  params: ChatSessionIdParams,
  response: {
    200: ChatMessagesResponse,
    400: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
} satisfies FastifySchema;

export const DeleteChatSessionRoute = {
  description: "Delete a chat session",
  tags: ["chat"],
  headers: AnonymousIdHeaders,
  params: ChatSessionIdParams,
  response: {
    200: DeleteSessionResponse,
    400: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
} satisfies FastifySchema;

export const SendChatMessageRoute = {
  description: "Send a message and stream the assistant reply (SSE)",
  tags: ["chat"],
  headers: AnonymousIdHeaders,
  params: ChatSessionIdParams,
  body: SendMessageBody,
  response: { 400: ErrorResponse, 404: ErrorResponse },
} satisfies FastifySchema;
