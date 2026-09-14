export const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemma-4-26b-a4b-it:free",
  },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { id: "ollama", label: "Ollama (Local)", defaultModel: "llama3" },
] as const;

export const EMBEDDING_PROVIDERS = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama (Local)" },
] as const;
