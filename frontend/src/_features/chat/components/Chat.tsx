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
import { useDemoProjects } from "@/src/_features/demo/hooks/useDemoProjects";
import { IS_DEMO, DEMO_PROJECTS } from "@/src/shared/constants";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";
import { ChatSuggestions } from "./ChatSuggestions";

export function Chat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { isDemo, ensureProject } = useDemoProjects();
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

  // Non-demo: auto-select the last-used project (or the first one).
  useEffect(() => {
    if (projectId || projectsLoading || isDemo) return;
    if (projects.length === 0) return;
    const stored = useActiveProjectStore.getState().lastProjectId;
    const target = projects.find((p) => p.id === stored)?.id ?? projects[0].id;
    setLastProjectId(target);
    router.replace(`/app?project=${target}`);
  }, [projectId, projectsLoading, projects, isDemo, router, setLastProjectId]);

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

  const handleDemoProjectClick = async (demo: (typeof DEMO_PROJECTS)[number]) => {
    const id = await ensureProject(demo);
    if (id) {
      setLastProjectId(id);
      router.push(`/app?project=${id}`);
    }
  };

  const handleBranchChange = async (branchName: string) => {
    if (!projectId) return;
    await prepareProjectBranch(projectId, branchName);
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    toast.success(`Ready to chat on ${branchName}`);
    setBranch(projectId, branchName);
  };

  const { messages, messagesLoading, streamingId, isStreaming, isAwaitingResponse, ingestionProgress, input, setInput, sendMessage, bottomRef } =
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
    const p = new URLSearchParams(window.location.search);
    p.delete("q");
    router.replace(`/app?${p.toString()}`, { scroll: false });
    void sendMessageRef.current(q);
  }, [q, projectId, isStreaming, messagesLoading, router, searchParams]);

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
                    onClick={() => handleDemoProjectClick(demo)}
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
                  Select or connect a repository from the sidebar to start asking questions about your code history.
                </EmptyDescription>
              </EmptyHeader>
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
    </div>
  );
}
