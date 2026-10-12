"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { JobState } from "@/hooks/use-job";
import { cn } from "@/lib/utils";

export function JobProgress({ state, label, className }: { state: JobState | null; label: string; className?: string }) {
  if (!state) return null;
  if (state.status === "failed") {
    return (
      <div role="alert" className={cn("flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive", className)}>
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{state.error ?? "Something went wrong."}</span>
      </div>
    );
  }
  if (state.status === "succeeded") return null;
  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/30 px-4 py-3", className)} aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-tally" /> {label}
        </span>
        <span className="tabular text-xs text-muted-foreground">{state.progress}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-tally transition-[width] duration-700" style={{ width: `${Math.max(4, state.progress)}%` }} />
      </div>
    </div>
  );
}
