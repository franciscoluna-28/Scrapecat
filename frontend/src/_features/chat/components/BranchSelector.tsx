"use client";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/src/components/ui/combobox";

type BranchSelectorProps = {
  branches: string[];
  value: string | null;
  onValueChange: (branch: string) => void;
};

export function BranchSelector({ branches, value, onValueChange }: BranchSelectorProps) {
  return (
    <Combobox
      items={branches}
      value={value}
      onValueChange={(v) => {
        if (typeof v === "string" && v) {
          onValueChange(v);
        }
      }}
    >
      <ComboboxTrigger className="h-7 rounded-md border-none bg-transparent px-2 font-medium text-muted-foreground text-xs shadow-none transition-colors hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground">
        {value ?? "Branch"}
      </ComboboxTrigger>
      <ComboboxContent className="w-64">
        <ComboboxInput placeholder="Search branches..." showTrigger={false} />
        <ComboboxList>
          <ComboboxCollection>
            {(b) => (
              <ComboboxItem key={b} value={b} className="text-xs">
                {b}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
        <ComboboxEmpty>No branches found</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
