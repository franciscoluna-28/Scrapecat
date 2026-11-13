"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/src/components/ui/empty";
import { useAIChat } from "@/src/_features/chat/hooks/useAIChat";
import { useChatProject } from "@/src/_features/chat/hooks/useChatProject";
import { useAutoSendPrompt } from "@/src/_features/chat/hooks/useAutoSendPrompt";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { useActiveProjectStore } from "@/src/store/active-project";
import { IS_DEMO, DEMO_PROJECTS } from "@/src/shared/constants";
import { AddRepositoryDialog } from "./AddRepositoryDialog";
import { NewChatDialog } from "./NewChatDialog";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { ChatSuggestions } from "./ChatSuggestions";

export function Chat() {
  const router = useRouter();
  const { projects } = useProjects();
  const setLastProjectId = useActiveProjectStore((s) => s.setLastProjectId);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const {
    projectId,
    sessionId,
    activeProject,
    branches,
    branch,
    defaultBranch,
    selectProject,
    changeBranch,
  } = useChatProject();

  const {
    messages,
    messagesLoading,
    streamingId,
    isStreaming,
    isAwaitingResponse,
    ingestionProgress,
    input,
    setInput,
    sendMessage,
  } = useAIChat({ projectId, sessionId, branch });

  useAutoSendPrompt({ projectId, isStreaming, messagesLoading, sendMessage });

  const hasProjects = projects.length > 0;

  const openProject = (projectId: string) => {
    setLastProjectId(projectId);
    setNewChatOpen(false);
    setConnectOpen(false);
    router.push(`/app/chat?project=${projectId}`);
  };

  const startChat = () => {
    if (hasProjects) {
      setNewChatOpen(true);
    } else {
      setConnectOpen(true);
    }
  };

  return (
    <div className="w-full min-h-full flex flex-col mx-auto">
      {!projectId ? (
        IS_DEMO ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md space-y-6">
              <div className="text-center space-y-2">
                <BookOpen className="size-10 text-muted-foreground mx-auto" />
                <h2 className="text-lg font-semibold">Welcome to Demo Mode</h2>
                <p className="text-sm text-muted-foreground">
                  Select a repository to start asking questions about its recent commits.
                </p>
              </div>
              <div className="grid gap-3">
                {DEMO_PROJECTS.map((demo) => (
                  <button
                    key={demo.repo}
                    onClick={() => selectProject(demo)}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <span className="font-medium">{demo.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{demo.owner}/{demo.repo}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Empty className="max-w-md border-0">
              <EmptyMedia>
                <BookOpen className="size-12 text-muted-foreground" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg font-semibold">Welcome</EmptyTitle>
                <EmptyDescription className="text-sm text-muted-foreground">
                  {hasProjects
                    ? "Pick a project to start a chat, or connect a new repository."
                    : "Connect a repository to start asking questions about its commits."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={startChat}>
                  {hasProjects ? "Start a chat" : "Connect a repository"}
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        )
      ) : (
        <div className="flex flex-col flex-1">
          <ChatMessages
            messages={messages}
            streamingId={streamingId}
            awaitingResponse={isAwaitingResponse}
            isLoading={messagesLoading}
            sessionId={sessionId}
            projectName={activeProject}
            ingestionProgress={ingestionProgress}
          />
          <div className="sticky bottom-0 z-10 bg-background px-4 pt-2 pb-3">
            <div className="max-w-[800px] mx-auto w-full">
              <ChatComposer
                branches={branches}
                branch={branch}
                defaultBranch={defaultBranch}
                input={input}
                onInputChange={setInput}
                onSubmit={sendMessage}
                onBranchChange={changeBranch}
                isStreaming={isStreaming}
                isAwaitingResponse={isAwaitingResponse}
                projectName={activeProject}
              />
              <ChatSuggestions onSelect={sendMessage} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {IS_DEMO
                  ? "Demo mode: read-only commit metadata (messages, dates, authors, file names). No code, no API keys, no write access."
                  : "Answers are grounded in the project’s ingested commits. Sources are shown as citations."}
              </p>
            </div>
          </div>
        </div>
      )}

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onSelectProject={openProject}
        onConnectRepository={() => {
          setNewChatOpen(false);
          setConnectOpen(true);
        }}
      />
      <AddRepositoryDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onProjectSelected={openProject}
      />
    </div>
  );
}
