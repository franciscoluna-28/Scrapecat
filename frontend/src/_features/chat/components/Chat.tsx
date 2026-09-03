"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProjectStore } from "@/src/store/active-project";
import { Skeleton } from "@/src/components/ui/skeleton";
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
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/src/components/ui/empty";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { useBranches } from "@/src/_features/reports/services/api";
import {
  useChatMessages,
  useCreateChatSession,
  streamChatMessage,
  prepareProjectBranch,
} from "@/src/_features/chat/services/chat-api";
import { CitationCard } from "@/src/_features/chat/components/CitationCard";
import { ReportFormMessage } from "@/src/_features/chat/components/ReportFormMessage";
import { queryKeys } from "@/src/shared/services/keys";
import type { ChatMessage } from "@/src/shared/types";
import { BookOpen, ArrowUp, FileText } from "lucide-react";
import { toast } from "sonner";
import { Suggestions, Suggestion } from "@/src/components/ai-elements/suggestion";

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");
  const branch = searchParams.get("branch");

  const activeProject = projects.find((p) => p.id === projectId)?.repositoryName ?? null;
  const activeProjectData = projects.find((p) => p.id === projectId) ?? null;
  const { setLastProjectId } = useActiveProjectStore();

  useEffect(() => {
    if (!projectsLoading && projects.length > 0 && !projectId) {
      const stored = useActiveProjectStore.getState().lastProjectId;
      const target = stored && projects.find((p) => p.id === stored) ? stored : projects[0].id;
      setLastProjectId(target);
      const p = new URLSearchParams(searchParams.toString());
      p.set("project", target);
      router.replace(`/app?${p.toString()}`);
    }
  }, [projectsLoading, projects, projectId, router, searchParams, setLastProjectId]);

  useEffect(() => {
    if (projectId) {
      setLastProjectId(projectId);
    }
  }, [projectId, setLastProjectId]);

  const { branches, isLoading: branchesLoading } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
  );

  const handleBranchChange = async (branchName: string) => {
    if (!projectId) return;
    await prepareProjectBranch(projectId, branchName);
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    toast.success(`Ready to chat on ${branchName}`);
    const p = new URLSearchParams(searchParams.toString());
    p.set("branch", branchName);
    router.push(`/app?${p.toString()}`);
  };

  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(sessionId ?? undefined);
  const createSession = useCreateChatSession();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const streamingId = liveMessages.find((m) => m.id.startsWith("local-assistant"))?.id;

  const messages = useMemo(() => [...storedMessages, ...liveMessages], [storedMessages, liveMessages]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !projectId || isStreaming) return;
    setInput("");
    setIsStreaming(true);

    try {
      let sid = sessionId;
      if (!sid) {
        const created = await createSession.mutateAsync(projectId);
        sid = created.id;
        const p = new URLSearchParams(searchParams.toString());
        p.set("session", sid);
        router.push(`/app?${p.toString()}`, { scroll: false });
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

  const handleSubmit = (message: PromptInputMessage) => handleSend(message.text);

  const handleSuggestion = (suggestion: string) => {
    if (suggestion === "generate-report") {
      setShowReportForm(true);
    } else {
      handleSend(suggestion);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {!projectId ? (
        <div className="flex-1 flex items-center justify-center">
          <Empty className="max-w-md border-0">
            <EmptyMedia>
              <FileText className="size-12 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg font-semibold">Welcome</EmptyTitle>
              <EmptyDescription className="text-sm text-muted-foreground">
                Select or connect a repository from the sidebar to start asking questions about your code history.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 shrink-0 border-b px-4 py-1.5">
            <span className="text-xs text-muted-foreground shrink-0">Current branch</span>
            {branches.length > 0 && (
              <Combobox
                items={branches}
                value={branch ?? branches[0] ?? ""}
                onValueChange={(v) => {
                  if (!v) return;
                  handleBranchChange(v);
                }}
                disabled={branchesLoading}
              >
                <ComboboxInput placeholder="Filter branch..." showClear={false} className="h-7 text-xs w-40" />
                <ComboboxContent>
                  <ComboboxEmpty>No branches found.</ComboboxEmpty>
                  <ComboboxList>
                    {(value) => (
                      <ComboboxItem key={value} value={value}>
                        {value}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 px-4">
            {messagesLoading && sessionId && storedMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="w-3/4 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-2/3" />
                </div>
              </div>
            ) : messages.length === 0 && !showReportForm ? (
              <ConversationEmptyState
                icon={<BookOpen className="size-12" />}
                title={`Ask about ${activeProject}`}
                description="For example, when was the RAG chat added, or what shipped this week."
              />
            ) : (
              <Conversation className="h-full">
                <ConversationContent>
                  {messages.map((m) => (
                    <MessageView key={m.id} message={m} streaming={m.id === streamingId} />
                  ))}
                  {showReportForm && activeProjectData && (
                    <ReportFormMessage
                      projectId={projectId}
                      repositoryName={activeProjectData.repositoryName}
                      providerOwner={activeProjectData.providerOwner}
                      providerProjectId={activeProjectData.providerProjectId}
                      branch={branch}
                      sessionId={sessionId ?? undefined}
                    />
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            )}
          </div>
          <div className="sticky bottom-0 z-10 bg-background border-t p-3">
            <PromptInput onSubmit={handleSubmit} className="flex gap-2 items-end">
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${activeProject} commits...`}
                disabled={isStreaming}
                className="flex-1"
              />
              <PromptInputSubmit
                status={isStreaming ? "streaming" : "ready"}
                disabled={!input.trim() || isStreaming}
              >
                <ArrowUp className="size-4" />
              </PromptInputSubmit>
            </PromptInput>
            {!showReportForm && messages.length === 0 && (
              <Suggestions className="mt-2">
                <Suggestion
                  suggestion="generate-report"
                  onClick={handleSuggestion}
                >
                  <FileText className="size-3" />
                  Generate report
                </Suggestion>
              </Suggestions>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Answers are grounded in the project&apos;s ingested commits. Sources are shown as citations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}