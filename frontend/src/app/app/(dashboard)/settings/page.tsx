"use client";

import { SectionLayout } from "@/src/components/global/SectionLayout";
import { DemoModeNotice } from "@/src/components/global/DemoModeNotice";
import { GitHubConnectionCard } from "@/src/_features/github/components/GitHubConnectionCard";
import { GitHubRepoSettingsCard } from "@/src/_features/github/components/GitHubRepoSettingsCard";
import { AISettingsManager } from "@/src/_features/settings/components/AISettingsManager";
import { IS_DEMO } from "@/src/shared/constants";

export default function SettingsPage() {
  if (IS_DEMO) {
    return (
      <SectionLayout>
        <DemoModeNotice
          title="Settings"
          description="Settings, API keys, and the GitHub token are managed by the server in demo mode. You can still add public repositories from the sidebar."
        />
      </SectionLayout>
    );
  }

  return (
    <SectionLayout>
      <GitHubConnectionCard />
      <GitHubRepoSettingsCard />
      <div className="mt-8">
        <AISettingsManager />
      </div>
    </SectionLayout>
  );
}
