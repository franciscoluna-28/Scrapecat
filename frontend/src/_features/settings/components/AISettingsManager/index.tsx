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
  reportProvider: AISettings["reportProvider"];
  reportModel: string;
  embeddingProvider: AISettings["embeddingProvider"];
  embeddingModel: string;
};

function draftFrom(settings?: AISettings): Draft {
  return {
    reportProvider: settings?.reportProvider ?? "openrouter",
    reportModel: settings?.reportModel ?? "",
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

  const { reportProvider, reportModel, embeddingProvider, embeddingModel } = draft;
  const setReportProvider = (reportProvider: AISettings["reportProvider"]) =>
    setDraft((d) => ({ ...d, reportProvider }));
  const setReportModel = (reportModel: string) =>
    setDraft((d) => ({ ...d, reportModel }));
  const setEmbeddingProvider = (embeddingProvider: AISettings["embeddingProvider"]) =>
    setDraft((d) => ({ ...d, embeddingProvider }));
  const setEmbeddingModel = (embeddingModel: string) =>
    setDraft((d) => ({ ...d, embeddingModel }));

  const {
    models: chatModels,
    isLoading: chatModelsLoading,
  } = useModels(reportProvider);

  const {
    models: embeddingModels,
    isLoading: embeddingModelsLoading,
  } = useModels(embeddingProvider, "embeddings");

  const dirty =
    !!settings &&
    (reportProvider !== settings.reportProvider ||
      reportModel !== settings.reportModel ||
      embeddingProvider !== settings.embeddingProvider ||
      embeddingModel !== settings.embeddingModel);

  const handleSave = async () => {
    if (!reportModel || !embeddingModel) {
      toast.error("Select a model for both report generation and embeddings");
      return;
    }

    try {
      await updateSettings.mutateAsync({
        reportProvider,
        reportModel,
        embeddingProvider,
        embeddingModel,
      });
      toast.success("AI settings saved");
    } catch {
      toast.error("Failed to save AI settings");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !settings) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-red-600">Failed to load AI settings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AISettingsCard
      reportProvider={reportProvider}
      setReportProvider={setReportProvider}
      reportModel={reportModel}
      setReportModel={setReportModel}
      embeddingProvider={embeddingProvider}
      setEmbeddingProvider={setEmbeddingProvider}
      embeddingModel={embeddingModel}
      setEmbeddingModel={setEmbeddingModel}
      chatModels={chatModels}
      chatModelsLoading={chatModelsLoading}
      embeddingModels={embeddingModels}
      embeddingModelsLoading={embeddingModelsLoading}
      mounted={mounted}
      dirty={dirty}
      isPending={updateSettings.isPending}
      onSave={handleSave}
    />
  );
}
