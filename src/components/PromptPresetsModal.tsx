"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { usePromptPresetsStore } from "@/src/store/prompt-presets";
import { Trash2, FileText, Save } from "lucide-react";

interface PromptPresetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrompt: string;
  onSelectPrompt: (prompt: string) => void;
}

export function PromptPresetsModal({
  open,
  onOpenChange,
  currentPrompt,
  onSelectPrompt,
}: PromptPresetsModalProps) {
  const { presets, addPreset, deletePreset } = usePromptPresetsStore();
  const [newPresetName, setNewPresetName] = useState("");

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    const prompt = currentPrompt.trim();
    if (!name || !prompt) return;
    addPreset(name, prompt);
    setNewPresetName("");
  };

  const handleLoad = (prompt: string) => {
    onSelectPrompt(prompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Prompt Presets</DialogTitle>
          <DialogDescription>
            Save the current instructions as a preset or load an existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Input
              placeholder="Save current as preset..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
              }}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSavePreset}
              disabled={!newPresetName.trim() || !currentPrompt.trim()}
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>

          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No presets saved yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-start gap-2 rounded-lg border p-3"
                >
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {preset.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {preset.prompt}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoad(preset.prompt)}
                    >
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deletePreset(preset.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
