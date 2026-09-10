"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProjectStore } from "@/src/store/active-project";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/src/components/ui/empty";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { useBranches } from "@/src/_features/chat/services/git-api";
import { prepareProjectBranch } from "@/src/_features/chat/services/chat-api";
import { queryKeys } from "@/src/shared/services/keys";
import { useAIChat } from "@/src/_features/chat/hooks/useAIChat";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { ChatSuggestions } from "./ChatSuggestions";

export function Chat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();
  const setLastProjectId = useActiveProjectStore((s) => s.setLastProjectId);

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");
  const branch = searchParams.get("branch");

  const activeProjectData = projects.find((p) => p.id === projectId) ?? null;
  const activeProject = activeProjectData?.repositoryName ?? null;

  const { branches, defaultBranch } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
  );

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

  useEffect(() => {
    if (defaultBranch && projectId && !branch) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("branch", defaultBranch);
      router.replace(`/app?${p.toString()}`);
    }
  }, [defaultBranch, projectId, branch, router, searchParams]);

  const handleBranchChange = async (branchName: string) => {
    if (!projectId) return;
    await prepareProjectBranch(projectId, branchName);
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    toast.success(`Ready to chat on ${branchName}`);
    const p = new URLSearchParams(searchParams.toString());
    p.set("branch", branchName);
    router.push(`/app?${p.toString()}`);
  };

  const { messages, messagesLoading, streamingId, isStreaming, ingestionProgress, input, setInput, sendMessage, bottomRef } =
    useAIChat({ projectId, sessionId, branch });

  return (
    <div className="w-full min-h-full flex flex-col mx-auto">
      {!projectId ? (
        <div className="flex-1 flex items-center justify-center">
          <Empty className="max-w-md border-0">
            <EmptyMedia>
              <BookOpen className="size-12 text-muted-foreground" />
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
        <div className="flex flex-col flex-1">
          <ChatMessages
            messages={messages}
            streamingId={streamingId}
            isLoading={messagesLoading}
            sessionId={sessionId}
            projectName={activeProject}
            ingestionProgress={ingestionProgress}
            bottomRef={bottomRef}
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
                onBranchChange={handleBranchChange}
                isStreaming={isStreaming}
                projectName={activeProject}
              />
              <ChatSuggestions onSelect={sendMessage} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Answers are grounded in the project&apos;s ingested commits. Sources are shown as citations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
