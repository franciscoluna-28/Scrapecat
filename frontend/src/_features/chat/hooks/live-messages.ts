import type { ChatMessage } from "@/src/shared/types";
import type { ProgressChunk } from "../services/chat-api";

/** Ids of optimistic (locally streamed) assistant messages start with this. */
export const STREAMING_PREFIX = "local-assistant";

export type ChatMessagesState = {
  sessionKey: string;
  messages: ChatMessage[];
  progress: ProgressChunk | null;
};

export type ChatMessagesAction =
  | { type: "reset"; sessionKey: string }
  | { type: "draft"; sessionKey: string; userMessage: ChatMessage; draft: ChatMessage; includeUser: boolean }
  | { type: "token"; sessionKey: string; content: string }
  | { type: "done"; sessionKey: string; message: ChatMessage }
  | { type: "error"; sessionKey: string }
  | { type: "progress"; sessionKey: string; progress: ProgressChunk | null }
  | { type: "clear"; sessionKey: string };

export function createChatMessagesState(sessionKey: string): ChatMessagesState {
  return { sessionKey, messages: [], progress: null };
}

function isStreamingMessage(message: ChatMessage): boolean {
  return message.id.startsWith(STREAMING_PREFIX);
}

function streamingIndex(messages: ChatMessage[]): number {
  return messages.findIndex(isStreamingMessage);
}

export function chatMessagesReducer(
  state: ChatMessagesState,
  action: ChatMessagesAction,
): ChatMessagesState {
  const current =
    state.sessionKey === action.sessionKey
      ? state
      : createChatMessagesState(action.sessionKey);

  switch (action.type) {
    case "reset":
      return createChatMessagesState(action.sessionKey);

    case "clear":
      return { ...current, messages: [], progress: null };

    case "draft":
      return {
        ...current,
        messages: [
          ...current.messages,
          ...(action.includeUser ? [action.userMessage] : []),
          action.draft,
        ],
      };

    case "token": {
      const index = streamingIndex(current.messages);
      if (index < 0) return current;
      const messages = [...current.messages];
      messages[index] = {
        ...messages[index],
        content: messages[index].content + action.content,
      };
      return { ...current, messages };
    }

    case "done": {
      const index = streamingIndex(current.messages);
      if (index < 0) return current;
      const messages = [...current.messages];
      messages[index] = action.message;
      return { ...current, messages };
    }

    case "error":
      return {
        ...current,
        messages: current.messages.filter((message) => !isStreamingMessage(message)),
      };

    case "progress":
      return { ...current, progress: action.progress };
  }
}
