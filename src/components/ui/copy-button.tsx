"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/src/components/ui/button";

type CopyButtonProps = {
  text: string;
  label?: string;
};

export function CopyButton({ text, label = "Copy Markdown" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const toast = await import("sonner").then((m) => m.toast);
      toast.error("Failed to copy");
    }
  }, [text]);

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="font-bold">
      <span className="relative inline-flex items-center justify-center gap-2">
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2 transition-opacity duration-300" style={{ opacity: copied ? 0 : 1 }}>
          <Copy className="h-4 w-4" />
          {label}
        </span>
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2 transition-opacity duration-300" style={{ opacity: copied ? 1 : 0 }}>
          <Check className="h-4 w-4" />
          Copied!
        </span>
        <span className="inline-flex items-center justify-center gap-2 invisible">
          <Copy className="h-4 w-4" />
          {label}
        </span>
      </span>
    </Button>
  );
}
