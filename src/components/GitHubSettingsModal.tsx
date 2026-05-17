"use client";

import { useEffect, useState } from "react";
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

export function GitHubSettingsModal({
  open,
  onOpenChange,
}: GitHubSettingsModalProps) {
  const {
    repositoryType,
    perPage,
    sort,
    direction,
    setRepositoryType,
    setPerPage,
    setSort,
    setDirection,
  } = useGitHubSettingsStore();

  const [tempRepositoryType, setTempRepositoryType] = useState(repositoryType);
  const [tempPerPage, setTempPerPage] = useState(perPage);
  const [tempSort, setTempSort] = useState(sort);
  const [tempDirection, setTempDirection] = useState(direction);

  // When the modal opens, initialize the temporary state with the current settings
  useEffect(() => {
    if (open) {
      setTempRepositoryType(repositoryType);
      setTempPerPage(perPage);
      setTempSort(sort);
      setTempDirection(direction);
    }
  }, [open]);

  const handleAccept = () => {
    setRepositoryType(tempRepositoryType);
    setPerPage(tempPerPage);
    setSort(tempSort);
    setDirection(tempDirection);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTempRepositoryType(repositoryType);
    setTempPerPage(perPage);
    setTempSort(sort);
    setTempDirection(direction);
    onOpenChange(false);
  };

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
              value={tempRepositoryType}
              onValueChange={(value: any) => setTempRepositoryType(value)}
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
              value={tempPerPage}
              onChange={(e) => setTempPerPage(parseInt(e.target.value) || 10)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sort" className="text-right">
              Sort By
            </Label>
            <Select
              value={tempSort}
              onValueChange={(value: any) => setTempSort(value)}
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
              value={tempDirection}
              onValueChange={(value: any) => setTempDirection(value)}
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
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleAccept}>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
