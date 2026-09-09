"use client";

import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { PROVIDERS } from "@/src/shared/constants";
import { ModelSelector } from "@/src/_features/settings/components/ModelSelector";
import type { AISettings } from "@/src/shared/services/ai-settings";

type Model = {
  id: string;
  name: string;
  free?: boolean;
};

type AISettingsCardProps = {
  reportProvider: AISettings["reportProvider"];
  setReportProvider: (value: AISettings["reportProvider"]) => void;
  reportModel: string;
  setReportModel: (value: string) => void;
  embeddingModel: string;
  setEmbeddingModel: (value: string) => void;
  chatModels: Model[];
  chatModelsLoading: boolean;
  embeddingModels: Model[];
  embeddingModelsLoading: boolean;
  mounted: boolean;
  dirty: boolean;
  isPending: boolean;
  onSave: () => void;
};

export function AISettingsCard({
  reportProvider,
  setReportProvider,
  reportModel,
  setReportModel,
  embeddingModel,
  setEmbeddingModel,
  chatModels,
  chatModelsLoading,
  embeddingModels,
  embeddingModelsLoading,
  mounted,
  dirty,
  isPending,
  onSave,
}: AISettingsCardProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold">AI Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the models Scrapecat uses across the app. Changes here apply
            globally.
          </p>
        </div>

        <div className="space-y-3">
          <div className="max-w-xs">
            <Label htmlFor="report-provider" className="text-sm font-medium">
              Report Generation Provider
            </Label>
            <Select
              value={reportProvider}
              onValueChange={(v) =>
                setReportProvider(v as AISettings["reportProvider"])
              }
            >
              <SelectTrigger id="report-provider" className="mt-1.5">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="report-model" className="text-sm font-medium">
              Report Generation Model
            </Label>
            <div className="mt-1.5">
              <ModelSelector
                models={chatModels}
                selectedModel={reportModel}
                onModelChange={setReportModel}
                loading={chatModelsLoading}
                mounted={mounted}
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="max-w-xs">
            <Label htmlFor="embedding-model" className="text-sm font-medium">
              Embeddings Model
            </Label>
            <div className="mt-1.5">
              <ModelSelector
                models={embeddingModels}
                selectedModel={embeddingModel}
                onModelChange={setEmbeddingModel}
                loading={embeddingModelsLoading}
                mounted={mounted}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              OpenRouter · limited to 512-dimension models. Changing it applies
              to newly synced commits; existing embeddings keep their model.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!dirty || isPending} size="sm">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
