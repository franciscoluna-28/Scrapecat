export const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemma-4-26b-a4b-it:free",
  },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
] as const;
