"use client";

import { useState, useMemo } from "react";
import { ArrowUp, Bot } from "lucide-react";
import {
  PromptInput,
  PromptInputHeader,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputButton,
} from "@/src/components/ai-elements/prompt-input";
import { BranchSelector } from "./BranchSelector";
import { ModelSelectorDialog } from "./ModelSelectorDialog";
import { useChatModelStore } from "@/src/store/chat-model";
import { useAllModels } from "@/src/shared/services/ai-models";
import { useAISettings } from "@/src/shared/services/ai-settings";
import { PROVIDERS } from "@/src/shared/constants";

type ChatComposerProps = {
  branches: string[];
  branch: string | null;
  defaultBranch: string | null;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onBranchChange: (branch: string) => void;
  isStreaming: boolean;
  projectName: string | null;
};

export function ChatComposer({
  branches,
  branch,
  defaultBranch,
  input,
  onInputChange,
  onSubmit,
  onBranchChange,
  isStreaming,
  projectName,
}: ChatComposerProps) {
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const { provider, model, setModel } = useChatModelStore();
  const { settings } = useAISettings();
  const { models } = useAllModels();

  const modelMap = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m])), [models]);

  const activeProvider = provider ?? settings?.reportProvider ?? "openrouter";
  const activeModel = model ?? settings?.reportModel ?? "";

  const providerLabel = PROVIDERS.find((p) => p.id === activeProvider)?.label ?? activeProvider;
  const modelLabel = modelMap[activeModel]?.name ?? activeModel.split("/").pop() ?? "Default";

  return (
    <>
      <ModelSelectorDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        onSelect={setModel}
      />
      <PromptInput onSubmit={(message) => onSubmit(message.text)}>
        {branches.length > 0 && (
          <PromptInputHeader>
            <BranchSelector
              branches={branches}
              value={branch ?? defaultBranch ?? branches[0] ?? null}
              onValueChange={onBranchChange}
            />
          </PromptInputHeader>
        )}
        <PromptInputBody>
          <PromptInputTextarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={`Ask about ${projectName} commits...`}
            disabled={isStreaming}
            className="flex-1"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputButton
            variant="ghost"
            onClick={() => setModelDialogOpen(true)}
            tooltip="Select model"
          >
            <Bot className="size-4" />
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {providerLabel} · {modelLabel}
            </span>
          </PromptInputButton>
          <PromptInputSubmit
            className="ml-auto"
            status={isStreaming ? "streaming" : "ready"}
            disabled={!input.trim() || isStreaming}
          >
            <ArrowUp className="size-4" />
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </>
  );
}
