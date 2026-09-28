export const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "google/gemma-4-26b-a4b-it:free",
  },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat" },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { id: "ollama", label: "Ollama (Local)", defaultModel: "llama3.2:1b" },
] as const;

export const EMBEDDING_PROVIDERS = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama (Local)" },
] as const;

// Demo mode is opt-in via NEXT_PUBLIC_DEMO_MODE="true". When enabled the UI
// pre-loads onto the bundled demo repository, shows canned questions and an
// onboarding popup, and hides BYOK. The open-source product is untouched
// unless the env var is set.
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export type DemoProject = {
  /** GitHub numeric repository id — the stable, unique external id. */
  id: string;
  owner: string;
  repo: string;
  label: string;
  defaultBranch: string;
};

// The fixed repositories demo visitors can chat with. They are always shown in
// the sidebar, and the first one (formbricks) is auto-selected on load so a
// visitor never starts from an empty workspace. `id` is the GitHub numeric repo
// id (must stay in sync with the backend's canonical id) and `defaultBranch`
// must match the repo's actual default (formbricks → main, Scrapecat → master)
// so ingestion targets a branch that exists.
export const DEMO_PROJECTS: DemoProject[] = [
  { id: "500289888", owner: "formbricks", repo: "formbricks", label: "formbricks", defaultBranch: "main" },
  { id: "1228095278", owner: "franciscoluna-28", repo: "Scrapecat", label: "Scrapecat", defaultBranch: "master" },
];

// The repo visitors always land on first in demo mode.
export const DEMO_DEFAULT_REPO = DEMO_PROJECTS[0].repo;

export const DEMO_QUESTIONS: { suggestion: string; label: string }[] = [
  { suggestion: "What shipped in the last 30 days?", label: "What shipped recently?" },
  { suggestion: "What broke and got fixed?", label: "What broke & got fixed?" },
  { suggestion: "What changed in the API or billing?", label: "API & billing changes" },
];

// Whether visitors can connect new repositories. Default true. Set
// NEXT_PUBLIC_ALLOW_ADD_REPOS="false" to lock the UI to the repos already
// ingested — e.g. for the hackathon demo after seeding.
export const ALLOW_ADD_REPOS =
  process.env.NEXT_PUBLIC_ALLOW_ADD_REPOS !== "false";
