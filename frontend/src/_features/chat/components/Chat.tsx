"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/src/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/src/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/src/components/ai-elements/prompt-input";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { useBranches } from "@/src/_features/reports/services/api";
import {
  useChatSessions,
  useChatMessages,
  useCreateChatSession,
  useDeleteChatSession,
  prepareProjectBranch,
  streamChatMessage,
} from "@/src/_features/chat/services/chat-api";
import { CitationCard } from "@/src/_features/chat/components/CitationCard";
import { queryKeys } from "@/src/shared/services/keys";
import type { ChatMessage } from "@/src/shared/types";
import {
  Plus,
  Trash2,
  MessageSquareText,
  Bot,
  BookOpen,
} from "lucide-react";

function MessageView({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === "assistant" ? (
          <>
            <MessageResponse>{message.content}</MessageResponse>
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-middle" />
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </MessageContent>
      {message.role === "assistant" && (
        <p className="text-[11px] text-muted-foreground">
          Source scope: {message.branch ?? "all branches"}
        </p>
      )}
      {message.role === "assistant" && message.citations.length > 0 && (
        <div className="flex w-full flex-wrap gap-2">
          {message.citations.map((c) => (
            <CitationCard key={c.commitSha} citation={c} />
          ))}
        </div>
      )}
    </Message>
  );
}

export function Chat() {
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [preparingBranch, setPreparingBranch] = useState<string | null>(null);

  const { sessions, isLoading: sessionsLoading } = useChatSessions(projectId);
  const activeProjectData = projects.find((p) => p.id === projectId);
  const { branches: remoteBranches, isLoading: branchesLoading } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
  );
  const branches = remoteBranches.length > 0
    ? remoteBranches
    : activeProjectData?.indexedBranches ?? [];
  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(sessionId);
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();

  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const streamingId = liveMessages.find((m) => m.id.startsWith("local-assistant"))?.id;

  const messages = useMemo(
    () => [...storedMessages, ...liveMessages],
    [storedMessages, liveMessages],
  );

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.repositoryName])),
    [projects],
  );
  const activeProject = projectId ? projectMap[projectId] ?? null : null;

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setSessionId(undefined);
    setLiveMessages([]);
    setBranch(null);
  };

  const handleBranchChange = async (value: string | null) => {
    if (!value) return;
    if (value === "__all__") {
      setBranch(null);
      return;
    }
    if (!projectId || preparingBranch) return;
    setPreparingBranch(value);
    try {
      const result = await prepareProjectBranch(projectId, value);
      setBranch(value);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
      toast.success(`Ready to chat on ${value}`, {
        description: `${result.commitsFound} commits processed.`,
      });
    } catch (error) {
      toast.error(`Could not prepare ${value}`, {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPreparingBranch(null);
    }
  };

  const handleNewChat = () => {
    setSessionId(undefined);
    setLiveMessages([]);
  };

  const handleDeleteSession = async (sid: string) => {
    if (sid === sessionId) {
      setSessionId(undefined);
      setLiveMessages([]);
    }
    await deleteSession.mutateAsync(sid);
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !projectId || isStreaming || preparingBranch) return;
    setInput("");
    setIsStreaming(true);

    try {
      let sid = sessionId;
      if (!sid) {
        const created = await createSession.mutateAsync(projectId);
        sid = created.id;
        setSessionId(sid);
      }

      const userMsg: ChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      const draft: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      setLiveMessages((m) => [...m, userMsg, draft]);

      await streamChatMessage(sid, trimmed, branch, (chunk) => {
        if (chunk.type === "token") {
          setLiveMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((msg) => msg.id === draft.id);
            if (idx >= 0) copy[idx] = { ...copy[idx], content: copy[idx].content + chunk.content };
            return copy;
          });
        } else if (chunk.type === "done") {
          setLiveMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((msg) => msg.id === draft.id);
            if (idx >= 0) copy[idx] = { ...chunk.message };
            return copy;
          });
        }
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
      setLiveMessages([]);
    } catch {
      setLiveMessages((m) => m.filter((msg) => !msg.id.startsWith("local-assistant")));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (message: PromptInputMessage) => {
    handleSend(message.text);
  };

  const hasSelection = !!projectId;

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 p-4">
      <Card className="hidden w-64 shrink-0 flex-col md:flex">
        <CardContent className="flex flex-col gap-3 p-3 flex-1 overflow-hidden">
          <Combobox
            items={projects.map((p) => p.id)}
            itemToStringValue={(id) => projectMap[id] || id}
            value={projectId ?? ""}
            onValueChange={(v) => v && handleProjectChange(v)}
            disabled={projectsLoading}
          >
            <ComboboxInput
              placeholder={projectsLoading ? "Loading projects..." : "Search projects..."}
              showClear={false}
            />
            <ComboboxContent>
              <ComboboxEmpty>No projects found.</ComboboxEmpty>
              <ComboboxList>
                {(id) => (
                  <ComboboxItem key={id} value={id}>
                    {projectMap[id]}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Combobox
            items={["__all__", ...branches]}
            itemToStringValue={(value) => value === "__all__" ? "All branches" : value}
            value={branch ?? "__all__"}
            onValueChange={handleBranchChange}
            disabled={branchesLoading || !hasSelection || !!preparingBranch}
          >
            <ComboboxInput placeholder={preparingBranch ? `Preparing ${preparingBranch}...` : branchesLoading ? "Loading branches..." : "Filter branch..."} showClear={false} />
            <ComboboxContent>
              <ComboboxEmpty>No branches found.</ComboboxEmpty>
              <ComboboxList>
                {(value) => (
                  <ComboboxItem key={value} value={value}>
                    {value === "__all__"
                      ? "All branches"
                      : value}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleNewChat}
            disabled={!hasSelection}
          >
            <Plus className="size-4" />
            New chat
          </Button>

          <div className="flex-1 overflow-y-auto space-y-1">
            {sessionsLoading ? (
              <div className="space-y-2 p-1">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {hasSelection ? "No chats yet" : "Select a project to begin"}
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-accent ${
                    s.id === sessionId ? "bg-accent" : ""
                  }`}
                  onClick={() => {
                    setSessionId(s.id);
                    setLiveMessages([]);
                  }}
                >
                  <MessageSquareText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {s.title === "New chat"
                      ? new Date(s.updatedAt).toLocaleDateString("en-US")
                      : s.title}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-1 flex-col overflow-hidden">
        {!hasSelection ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Bot className="size-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Ask about your engineering history</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Pick a synced project to ask questions about what changed, when, and
              by whom — grounded in real commits.
            </p>
          </div>
        ) : (
          <>
            <Conversation className="flex-1">
              <ConversationContent>
                {messagesLoading && messages.length === 0 ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-3/4" />
                    <Skeleton className="h-16 w-1/2" />
                  </div>
                ) : messages.length === 0 ? (
                  <ConversationEmptyState
                    icon={<BookOpen className="size-12" />}
                    title={`Ask about ${activeProject}`}
                    description="For example, when was the RAG chat added, or what shipped this week."
                  />
                ) : (
                  messages.map((m) => (
                    <MessageView
                      key={m.id}
                      message={m}
                      streaming={m.id === streamingId}
                    />
                  ))
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="border-t p-3">
              <PromptInput
                onSubmit={handleSubmit}
                className="flex gap-2 items-end"
              >
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this project's commits..."
                  disabled={isStreaming || !!preparingBranch}
                  className="flex-1"
                />
                <PromptInputSubmit
                  status={isStreaming ? "streaming" : "ready"}
                  disabled={!input.trim() || isStreaming || !!preparingBranch}
                />
              </PromptInput>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Answers are grounded in the project&apos;s ingested commits. Sources are shown as citations.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
