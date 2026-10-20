"use client";

import { SectionLayout } from "@/src/components/global/SectionLayout";
import { DemoModeNotice } from "@/src/components/global/DemoModeNotice";
import { GitProviderConnectionCard } from "@/src/_features/git-providers/components/GitProviderConnectionCard";
import { RepositoryDiscoverySettingsCard } from "@/src/_features/git-providers/components/RepositoryDiscoverySettingsCard";
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
      <GitProviderConnectionCard />
      <RepositoryDiscoverySettingsCard />
      <div className="mt-8">
        <AISettingsManager />
      </div>
    </SectionLayout>
  );
}
