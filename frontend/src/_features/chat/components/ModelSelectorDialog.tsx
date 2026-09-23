"use client";

import { useState } from "react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/src/components/ui/command";
import { Badge } from "@/src/components/ui/badge";
import { useAllModels } from "@/src/shared/services/ai-models";
import { PROVIDERS } from "@/src/shared/constants";

type ModelSelectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (provider: string, model: string) => void;
};

type Model = {
  id: string;
  name: string;
  free?: boolean;
  description?: string;
  provider?: string;
};

export function ModelSelectorDialog({
  open,
  onOpenChange,
  onSelect,
}: ModelSelectorDialogProps) {
  const { models, isLoading } = useAllModels();
  const [search, setSearch] = useState("");

  const grouped = models.reduce<Record<string, Model[]>>((acc, model) => {
    const provider = model.provider ?? "unknown";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {});

  const providerOrder = PROVIDERS.map((p) => p.id) as string[];
  const sortedProviders = Object.keys(grouped).sort((a, b) => {
    const ai = providerOrder.indexOf(a);
    const bi = providerOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const handleSelect = (model: Model) => {
    onSelect(model.provider ?? "openrouter", model.id);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Select Model"
      description="Choose an AI model for this chat"
      className="shadow-lg"
    >
      <Command>
        <CommandInput
          placeholder={isLoading ? "Loading models..." : "Search models..."}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No models found.</CommandEmpty>
          {sortedProviders.map((provider) => (
            <CommandGroup
              key={provider}
              heading={PROVIDERS.find((p) => p.id === provider)?.label ?? provider}
            >
              {grouped[provider].map((model) => (
                <CommandItem
                  key={model.id}
                  value={`${model.name} ${model.id} ${provider}`}
                  onSelect={() => handleSelect(model)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate">{model.name}</span>
                    {model.free && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                        Free
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate ml-2">
                    {model.id}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {sortedProviders.length > 1 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="All">
                {sortedProviders.flatMap((provider) =>
                  grouped[provider].map((model) => (
                    <CommandItem
                      key={`all-${model.id}`}
                      value={`${model.name} ${model.id} ${provider}`}
                      onSelect={() => handleSelect(model)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                          {PROVIDERS.find((p) => p.id === provider)?.label ?? provider}
                        </Badge>
                        <span className="truncate">{model.name}</span>
                        {model.free && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                            Free
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
