import { PROVIDERS } from "@/src/shared/constants";

export function ProviderIcon({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    openrouter: "bg-blue-100 text-blue-700",
    deepseek: "bg-purple-100 text-purple-700",
    openai: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${colors[provider] || "bg-muted text-muted-foreground"}`}
    >
      {PROVIDERS.find((p) => p.id === provider)?.label || provider}
    </span>
  );
}
