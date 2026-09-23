"use client";

import { Suggestions, Suggestion } from "@/src/components/ai-elements/suggestion";

type ChatSuggestionItem = {
  suggestion: string;
  variant: "default" | "secondary";
};

const CHAT_SUGGESTIONS: ChatSuggestionItem[] = [
  {
    suggestion: "What has engineering built this week?",
    variant: "secondary",
  },
  { suggestion: "What changed in the last 7 days?", variant: "secondary" },
  { suggestion: "What feature is being built?", variant: "secondary" },
];

type ChatSuggestionsProps = {
  onSelect: (suggestion: string) => void;
};

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <Suggestions className="mt-2">
      {CHAT_SUGGESTIONS.map((item) => (
        <Suggestion
          key={item.suggestion}
          suggestion={item.suggestion}
          onClick={onSelect}
          variant={item.variant}
        />
      ))}
    </Suggestions>
  );
}
