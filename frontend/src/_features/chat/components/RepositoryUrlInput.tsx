"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Link2 } from "lucide-react";

type RepositoryUrlInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onConnect: () => void;
  connecting: boolean;
  error: string | null;
};

export function RepositoryUrlInput({
  value,
  onValueChange,
  onConnect,
  connecting,
  error,
}: RepositoryUrlInputProps) {
  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Paste a GitHub URL or owner/repo"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConnect();
            }}
          />
        </div>
        <Button onClick={onConnect} disabled={connecting}>
          Connect
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}
    </>
  );
}
