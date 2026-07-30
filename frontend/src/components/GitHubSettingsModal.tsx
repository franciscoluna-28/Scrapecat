"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Input } from "@/src/components/ui/input";
import { useGitHubSettingsStore } from "@/src/store/github-settings";

interface GitHubSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useGitHubSettings(open: boolean) {
  const store = useGitHubSettingsStore();

  const [values, setValues] = useState({
    repositoryType: store.repositoryType,
    perPage: store.perPage,
    sort: store.sort,
    direction: store.direction,
  });

  if (open) {
    setValues({
      repositoryType: store.repositoryType,
      perPage: store.perPage,
      sort: store.sort,
      direction: store.direction,
    });
  }

  const accept = () => {
    store.setRepositoryType(values.repositoryType);
    store.setPerPage(values.perPage);
    store.setSort(values.sort);
    store.setDirection(values.direction);
  };

  return { values, setValues, accept };
}

export function GitHubSettingsModal({
  open,
  onOpenChange,
}: GitHubSettingsModalProps) {
  const { values, setValues, accept } = useGitHubSettings(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>GitHub Repository Settings</DialogTitle>
          <DialogDescription>
            Configure the settings to fetch GitHub repositories.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <Select
              value={values.repositoryType}
              onValueChange={(repositoryType: any) => setValues((prev) => ({ ...prev, repositoryType }))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select repository type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="perPage" className="text-right">
              Per Page
            </Label>
            <Input
              id="perPage"
              type="number"
              min="1"
              max="100"
              value={values.perPage}
              onChange={(e) => setValues((prev) => ({ ...prev, perPage: parseInt(e.target.value) || 10 }))}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sort" className="text-right">
              Sort By
            </Label>
            <Select
              value={values.sort}
              onValueChange={(sort: any) => setValues((prev) => ({ ...prev, sort }))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select sort field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="pushed">Pushed</SelectItem>
                <SelectItem value="full_name">Full Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="direction" className="text-right">
              Direction
            </Label>
            <Select
              value={values.direction}
              onValueChange={(direction: any) => setValues((prev) => ({ ...prev, direction }))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select sort direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => { accept(); onOpenChange(false); }}>
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
