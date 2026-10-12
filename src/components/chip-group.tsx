"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChipGroupProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  id?: string;
  mono?: boolean;
}

/** Multi-select as a row of toggle chips. */
export function ChipGroup<T extends string>({ options, value, onChange, id, mono }: ChipGroupProps<T>) {
  return (
    <div id={id} role="group" className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((v) => v !== option.id) : [...value, option.id])}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
              mono && "font-mono",
              selected && "border-tally/60 bg-tally/10 text-foreground",
            )}
          >
            {selected && <Check className="size-3 text-tally" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
