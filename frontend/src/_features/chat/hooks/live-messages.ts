import type { ChatMessage } from "@/src/shared/types";

/** Ids of optimistic (locally streamed) assistant messages start with this. */
export const STREAMING_PREFIX = "local-assistant";

function isStreamingMessage(message: ChatMessage): boolean {
  return message.id.startsWith(STREAMING_PREFIX);
}

/**
 * Adds the optimistic user message (unless it was just created server-side) and
 * the empty assistant draft that tokens stream into.
 */
export function appendDraft(
  messages: ChatMessage[],
  userMessage: ChatMessage,
  draft: ChatMessage,
  includeUser: boolean,
): ChatMessage[] {
  return [...messages, ...(includeUser ? [userMessage] : []), draft];
}

/** Appends a token to the streaming assistant message (no-op if absent). */
export function appendToken(messages: ChatMessage[], content: string): ChatMessage[] {
  const index = messages.findIndex(isStreamingMessage);
  if (index < 0) return messages;
  const next = [...messages];
  next[index] = { ...next[index], content: next[index].content + content };
  return next;
}

/** Replaces the streaming draft with the final persisted assistant message. */
export function replaceStreaming(
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage[] {
  const index = messages.findIndex(isStreamingMessage);
  if (index < 0) return messages;
  const next = [...messages];
  next[index] = message;
  return next;
}

/** Drops the streaming draft (on error), leaving any user message in place. */
export function removeStreaming(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => !isStreamingMessage(message));
}
