"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { IS_DEMO, DEMO_DEFAULT_REPO, DEMO_QUESTIONS } from "@/src/shared/constants";

const STORAGE_KEY = "scrapecat-demo-onboarded";

function markSeen() {
  window.localStorage.setItem(STORAGE_KEY, "1");
}

export function DemoOnboarding() {
  const router = useRouter();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!IS_DEMO) return;
    if (window.localStorage.getItem(STORAGE_KEY) !== "1") {
      setOpen(true);
    }
  }, []);

  if (!IS_DEMO) return null;

  const demoProject =
    projects.find((p) => p.repositoryName === DEMO_DEFAULT_REPO) ?? projects[0] ?? null;

  const startQuestion = (q: string) => {
    markSeen();
    setOpen(false);
    if (!demoProject) {
      router.push("/app");
      return;
    }
    router.push(`/app?project=${demoProject.id}&q=${encodeURIComponent(q)}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) markSeen();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Welcome to the Scrapecat demo</DialogTitle>
          <DialogDescription className="text-sm">
            Ask about a repo&apos;s recent commits — answers cite real commits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {DEMO_QUESTIONS.map((q) => (
            <Button
              key={q.suggestion}
              variant="outline"
              className="justify-start h-auto py-2 px-3 text-left"
              onClick={() => startQuestion(q.suggestion)}
            >
              {q.label}
            </Button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Read-only commit metadata. No code, no keys, no write access.
        </p>
      </DialogContent>
    </Dialog>
  );
}