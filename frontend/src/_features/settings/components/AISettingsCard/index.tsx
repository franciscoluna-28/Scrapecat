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
import { EMBEDDING_PROVIDERS } from "@/src/shared/constants";
import { ModelSelector } from "@/src/_features/settings/components/ModelSelector";
import type { AISettings } from "@/src/shared/services/ai-settings";

type Model = {
  id: string;
  name: string;
  free?: boolean;
};

type AISettingsCardProps = {
  embeddingProvider: AISettings["embeddingProvider"];
  setEmbeddingProvider: (value: AISettings["embeddingProvider"]) => void;
  embeddingModel: string;
  setEmbeddingModel: (value: string) => void;
  embeddingModels: Model[];
  embeddingModelsLoading: boolean;
  mounted: boolean;
  dirty: boolean;
  isPending: boolean;
  onSave: () => void;
};

export function AISettingsCard({
  embeddingProvider,
  setEmbeddingProvider,
  embeddingModel,
  setEmbeddingModel,
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
          <h3 className="text-base font-semibold">Embeddings</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure the embedding model used for commit indexing. Chat model is
            selected per-conversation in the chat footer.
          </p>
        </div>

        <div className="space-y-3">
          <div className="max-w-xs">
            <Label htmlFor="embedding-provider" className="text-sm font-medium">
              Embedding Provider
            </Label>
            <Select
              value={embeddingProvider}
              onValueChange={(v) =>
                setEmbeddingProvider(v as AISettings["embeddingProvider"])
              }
            >
              <SelectTrigger id="embedding-provider" className="mt-1.5">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {EMBEDDING_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              {embeddingProvider === "ollama"
                ? "Local model · 768 dimensions · runs on your machine"
                : "OpenRouter · 768-dimension models. Changing it applies to newly synced commits; existing embeddings keep their model."}
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
