export const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemma-4-26b-a4b-it:free",
  },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
] as const;

// Demo mode is opt-in via NEXT_PUBLIC_DEMO_MODE="true". When enabled the UI
// pre-loads onto the bundled demo repository, shows canned questions and an
// onboarding popup, and hides BYOK. The open-source product is untouched
// unless the env var is set.
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// The repo visitors always land on first in demo mode.
export const DEMO_DEFAULT_REPO = "formbricks";

export const DEMO_QUESTIONS: { suggestion: string; label: string }[] = [
  { suggestion: "What shipped in the last 30 days?", label: "What shipped recently?" },
  { suggestion: "What broke and got fixed?", label: "What broke & got fixed?" },
  { suggestion: "What changed in the API or billing?", label: "API & billing changes" },
];
