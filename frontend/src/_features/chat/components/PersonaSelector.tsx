"use client";

import { UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Button } from "@/src/components/ui/button";
import { PERSONAS } from "@/src/shared/constants";
import { useChatPersonaStore } from "@/src/store/chat-persona";

export function PersonaSelector() {
  const { persona, setPersona } = useChatPersonaStore();
  const active = PERSONAS.find((p) => p.id === persona) ?? PERSONAS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          title="Who the answer is written for"
        >
          <UserRound className="size-4" />
          <span className="truncate max-w-[120px]">{active.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Answer for</DropdownMenuLabel>
        {PERSONAS.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => setPersona(p.id)}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="text-sm">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
