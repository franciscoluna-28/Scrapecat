"use client";

import { Suggestions, Suggestion } from "@/src/components/ai-elements/suggestion";
import { IS_DEMO, DEMO_QUESTIONS } from "@/src/shared/constants";

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
  // Demo deployments surface the canned questions so a visitor can click one
  // and immediately get a report with commit citations. The open-source app
  // keeps its default suggestions.
  const items: ChatSuggestionItem[] = IS_DEMO
    ? DEMO_QUESTIONS.map((q) => ({
        suggestion: q.suggestion,
        label: q.label,
        variant: "secondary" as const,
      }))
    : CHAT_SUGGESTIONS;

  return (
    <Suggestions className="mt-2">
      {items.map((item) => (
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
