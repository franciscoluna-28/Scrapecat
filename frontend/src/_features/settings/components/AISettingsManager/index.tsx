"use client";

import { useSyncExternalStore, useState } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { toast } from "sonner";
import {
  useAISettings,
  useUpdateAISettings,
  type AISettings,
} from "@/src/shared/services/ai-settings";
import { useModels } from "@/src/shared/services/ai-models";
import { AISettingsCard } from "@/src/_features/settings/components/AISettingsCard";

type Draft = {
  embeddingProvider: AISettings["embeddingProvider"];
  embeddingModel: string;
};

function draftFrom(settings?: AISettings): Draft {
  return {
    embeddingProvider: settings?.embeddingProvider ?? "openrouter",
    embeddingModel: settings?.embeddingModel ?? "",
  };
}

export function AISettingsManager() {
  const { settings, isLoading, error } = useAISettings();
  const updateSettings = useUpdateAISettings();

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setDraft(draftFrom(settings));
  }

  const { embeddingProvider, embeddingModel } = draft;
  const setEmbeddingProvider = (embeddingProvider: AISettings["embeddingProvider"]) =>
    setDraft((d) => ({ ...d, embeddingProvider }));
  const setEmbeddingModel = (embeddingModel: string) =>
    setDraft((d) => ({ ...d, embeddingModel }));

  const {
    models: embeddingModels,
    isLoading: embeddingModelsLoading,
  } = useModels(embeddingProvider, "embeddings");

  const dirty =
    !!settings &&
    (embeddingProvider !== settings.embeddingProvider ||
      embeddingModel !== settings.embeddingModel);

  const handleSave = async () => {
    if (!embeddingModel) {
      toast.error("Select an embedding model");
      return;
    }

    try {
      await updateSettings.mutateAsync({
        ...settings!,
        embeddingProvider,
        embeddingModel,
      });
      toast.success("Embedding settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !settings) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-red-600">Failed to load settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AISettingsCard
      embeddingProvider={embeddingProvider}
      setEmbeddingProvider={setEmbeddingProvider}
      embeddingModel={embeddingModel}
      setEmbeddingModel={setEmbeddingModel}
      embeddingModels={embeddingModels}
      embeddingModelsLoading={embeddingModelsLoading}
      mounted={mounted}
      dirty={dirty}
      isPending={updateSettings.isPending}
      onSave={handleSave}
    />
  );
}
