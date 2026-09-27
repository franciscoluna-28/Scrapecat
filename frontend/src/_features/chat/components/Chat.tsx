"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProjectStore } from "@/src/store/active-project";
import { useChatBranchStore } from "@/src/store/chat-branch";
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
import { IS_DEMO, DEMO_DEFAULT_REPO } from "@/src/shared/constants";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { ChatSuggestions } from "./ChatSuggestions";

export function Chat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();
  const setLastProjectId = useActiveProjectStore((s) => s.setLastProjectId);
  const { getBranch, setBranch } = useChatBranchStore();

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");

  const activeProjectData = projects.find((p) => p.id === projectId) ?? null;
  const activeProject = activeProjectData?.repositoryName ?? null;

  const { branches, defaultBranch } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
  );

  const branch = projectId ? getBranch(projectId, defaultBranch) : null;

  useEffect(() => {
    if (!projectsLoading && projects.length > 0 && !projectId) {
      const stored = useActiveProjectStore.getState().lastProjectId;
      // Demo always onboard onto the demo repo (formbricks by default) so the
      // first interaction is a loaded repo, not setup.
      const demoDefault = IS_DEMO
        ? projects.find((p) => p.repositoryName === DEMO_DEFAULT_REPO)
        : undefined;
      const target =
        (demoDefault ?? projects.find((p) => p.id === stored))?.id ?? projects[0].id;
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
    if (defaultBranch && projectId) {
      const stored = getBranch(projectId, null);
      if (!stored) {
        setBranch(projectId, defaultBranch);
      }
    }
  }, [defaultBranch, projectId, getBranch, setBranch]);

  const handleBranchChange = async (branchName: string) => {
    if (!projectId) return;
    await prepareProjectBranch(projectId, branchName);
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    toast.success(`Ready to chat on ${branchName}`);
    setBranch(projectId, branchName);
  };

  const { messages, messagesLoading, streamingId, isStreaming, ingestionProgress, input, setInput, sendMessage, bottomRef } =
    useAIChat({ projectId, sessionId, branch });

  // Demo: canned questions navigate here with a `q` param; send it once the
  // project is ready, then drop the param so it isn't re-run on refresh.
  const q = searchParams.get("q");
  const autoSentRef = useRef<string | null>(null);
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (!projectId || !q || isStreaming || messagesLoading) return;
    if (autoSentRef.current === q) return;
    autoSentRef.current = q;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("q");
    router.replace(`/app?${p.toString()}`, { scroll: false });
    void sendMessageRef.current(q);
  }, [q, projectId, isStreaming, messagesLoading, router, searchParams]);

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
                {IS_DEMO
                  ? "Demo mode: read-only commit metadata (messages, dates, authors, file names). No code, no API keys, no write access."
                  : "Answers are grounded in the project’s ingested commits. Sources are shown as citations."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
