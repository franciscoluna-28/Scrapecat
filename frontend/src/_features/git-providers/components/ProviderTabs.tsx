import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { GitProviderIcon } from "@/src/_features/git-providers/components/GitProviderIcon";
import {
  AVAILABLE_PROVIDERS,
  GIT_PROVIDER_META,
  type GitProviderId,
} from "@/src/shared/constants";

type ProviderTabsProps = {
  provider: GitProviderId;
  onSelect: (provider: GitProviderId) => void;
};

export function ProviderTabs({ provider, onSelect }: ProviderTabsProps) {
  return (
    <Tabs
      value={provider}
      onValueChange={(value) => onSelect(value as GitProviderId)}
    >
      <TabsList className="grid w-full grid-cols-2">
        {AVAILABLE_PROVIDERS.map((id) => (
          <TabsTrigger key={id} value={id}>
            <GitProviderIcon provider={id} className="size-3.5" />
            {GIT_PROVIDER_META[id].label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
