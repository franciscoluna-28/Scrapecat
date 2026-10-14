"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  GITHUB_DIRECTIONS,
  GITHUB_PER_PAGE,
  GITHUB_REPOSITORY_TYPES,
  GITHUB_SORT_OPTIONS,
  type DirectionType,
  type RepositoryType,
  type SortType,
} from "@/src/shared/constants";
import { useGitHubSettingsStore } from "@/src/store/github-settings";

export function GitHubRepoSettingsCard() {
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

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold">GitHub Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure how repositories are fetched from GitHub.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Repository Type</Label>
            <Select
              value={repositoryType}
              onValueChange={(v) => setRepositoryType(v as RepositoryType)}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {GITHUB_REPOSITORY_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perPage">Per Page</Label>
            <Input
              id="perPage"
              type="number"
              min={GITHUB_PER_PAGE.min}
              max={GITHUB_PER_PAGE.max}
              value={perPage}
              onChange={(e) =>
                setPerPage(parseInt(e.target.value) || GITHUB_PER_PAGE.default)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort">Sort By</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
              <SelectTrigger id="sort">
                <SelectValue placeholder="Select sort" />
              </SelectTrigger>
              <SelectContent>
                {GITHUB_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direction">Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as DirectionType)}
            >
              <SelectTrigger id="direction">
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent>
                {GITHUB_DIRECTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
