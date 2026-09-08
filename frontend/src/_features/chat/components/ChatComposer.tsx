"use client";

import { ArrowUp } from "lucide-react";
import {
  PromptInput,
  PromptInputHeader,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/src/components/ai-elements/prompt-input";
import { BranchSelector } from "./BranchSelector";

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
  return (
    <>
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
