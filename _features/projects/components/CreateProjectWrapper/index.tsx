"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "../CreateProject";
import { GitHubRepository } from "@/app/actions/github";

type Props = {
  repositories: GitHubRepository[];
};

export function CreateProjectWrapper({ repositories }: Props) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsCreateModalOpen(true)}>
        Create Project
      </Button>
      <CreateProjectModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        repositories={repositories}
      />
    </>
  );
}
