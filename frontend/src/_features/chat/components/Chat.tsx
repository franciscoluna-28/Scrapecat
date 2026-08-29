"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Components } from "react-markdown";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import {
  useChatSessions,
  useChatMessages,
  useCreateChatSession,
  useDeleteChatSession,
  streamChatMessage,
} from "@/src/_features/chat/services/chat-api";
import { CitationCard } from "@/src/_features/chat/components/CitationCard";
import { queryKeys } from "@/src/shared/services/keys";
import type { ChatMessage } from "@/src/shared/types";
import {
  Send,
  Plus,
  Trash2,
  MessageSquareText,
  Bot,
  User,
} from "lucide-react";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-1">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">
      {children}
    </code>
  ),
};

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
          isUser ? "bg-primary/10" : "bg-muted"
        }`}
      >
        {isUser ? (
          <User className="size-4 text-muted-foreground" />
        ) : (
          <Bot className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className={`min-w-0 max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}>
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 border border-border"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-foreground/90 [&_p]:break-words">
              <ReactMarkdown components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-middle" />
              )}
            </div>
          )}
        </div>
        {!isUser && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.citations.map((c) => (
              <div key={c.commitSha} className="w-64">
                <CitationCard citation={c} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Chat() {
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { sessions, isLoading: sessionsLoading } = useChatSessions(projectId);
  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(sessionId);
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();

  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const streamingId = liveMessages.find((m) => m.id.startsWith("local-assistant"))?.id;

  const messages = useMemo(
    () => [...storedMessages, ...liveMessages],
    [storedMessages, liveMessages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.repositoryName])),
    [projects],
  );
  const activeProject = projectId ? projectMap[projectId] ?? null : null;

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setSessionId(undefined);
    setLiveMessages([]);
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !projectId || isStreaming) return;
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
        content: text,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      const draft: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        citations: [],
        createdAt: new Date().toISOString(),
      };
      setLiveMessages((m) => [...m, userMsg, draft]);

      await streamChatMessage(sid, text, (chunk) => {
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
      textareaRef.current?.focus();
    }
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
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-4 p-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-3/4" />
                    <Skeleton className="h-16 w-1/2" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      Ask anything about {activeProject} — for example, when was the
                      RAG chat added, or what shipped this week.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      streaming={m.id === streamingId}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask about this project's commits..."
                  className="min-h-[44px] max-h-40 flex-1 resize-none"
                  disabled={isStreaming}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="self-end"
                  size="icon"
                >
                  <Send className="size-4" />
                </Button>
              </div>
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
