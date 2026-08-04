"use client";

import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Badge } from "@/src/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Label } from "@/src/components/ui/label";
import { Send, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { useChatAsk } from "@/src/_features/chat/services/chat-api";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { useModels } from "@/src/shared/services/ai-models";
import { useAISettingsStore } from "@/src/store/ai-settings";
import { PROVIDERS } from "@/src/shared/constants";
import type { ChatSource } from "@/src/shared/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 leading-relaxed text-sm">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 space-y-1.5 list-disc pl-5">{children}</ul>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  strong: ({ children }) => <strong>{children}</strong>,
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mb-2">{children}</h2>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
  ),
};

function SourceList({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Retrieved sources
      </p>
      {sources.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No vectors matched. Generate a report for this project first so
          commits are chunked and embedded.
        </p>
      ) : (
        sources.map((s, i) => (
          <div
            key={s.commitSha}
            className="rounded-md border bg-background/60 p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                {s.commitSha.slice(0, 7)}
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] font-normal"
              >
                {Math.round(s.similarity * 100)}%
              </Badge>
            </div>
            <p className="mt-1 text-xs text-foreground/90">
              {s.commitMessage}
            </p>
            {s.diffSummary && s.diffSummary !== s.commitMessage && (
              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                {s.diffSummary}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {s.author ?? "unknown"} ·{" "}
              {new Date(s.committedAt).toLocaleDateString()}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

export function ChatPanel() {
  const { projects, isLoading: isLoadingProjects } = useProjects();
  const { selectedProvider, selectedModel, setSelectedProvider, setSelectedModel } =
    useAISettingsStore();
  const { models } = useModels(selectedProvider);
  const chatAsk = useChatAsk();

  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const canSend =
    !!selectedProjectId &&
    input.trim().length > 0 &&
    !chatAsk.isPending;

  const handleSend = () => {
    if (!canSend || !selectedProjectId) return;

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    chatAsk.mutate(
      {
        projectId: selectedProjectId,
        question: userMessage.content,
        model: selectedModel,
        provider: selectedProvider,
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              role: "assistant",
              content: data.answer,
              sources: data.sources,
            },
          ]);
        },
        onError: (err) => {
          toast.error(err.message);
        },
      },
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex flex-wrap items-end gap-4 border-b bg-background/50 p-4">
        <div className="space-y-1.5 min-w-48">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={selectedProjectId ?? undefined}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingProjects ? (
                <SelectItem value="__loading" disabled>
                  Loading...
                </SelectItem>
              ) : projects.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No projects yet
                </SelectItem>
              ) : (
                projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.repositoryName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 min-w-32">
          <Label className="text-xs text-muted-foreground">Provider</Label>
          <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
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

        <div className="space-y-1.5 min-w-40">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl p-6 space-y-4">
          {messages.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">
                Ask about commits & changes
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Pick a project that already has a generated report (that is what
                chunks and embeds its commits), then ask a question. The answer
                will list the retrieved commit sources so you can verify the
                vectors.
              </p>
              <p className="text-xs text-muted-foreground">
                Example: &quot;What changed in the reports domain recently?&quot;
              </p>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5">
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start gap-3">
                <div className="mt-0.5 shrink-0 rounded-full bg-muted p-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="max-w-[85%] rounded-2xl border bg-background/60 px-4 py-3">
                  <div className="select-text">
                    <ReactMarkdown components={markdownComponents}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                  {m.sources && <SourceList sources={m.sources} />}
                </div>
              </div>
            ),
          )}

          {chatAsk.isPending && (
            <div className="flex justify-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-full bg-muted p-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-background/50 p-4">
        <div className="mx-auto max-w-3xl flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              selectedProject
                ? `Ask about ${selectedProject.repositoryName}...`
                : "Select a project first..."
            }
            disabled={!selectedProjectId}
            className="min-h-10 max-h-40 flex-1 text-sm"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send"
          >
            {chatAsk.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
