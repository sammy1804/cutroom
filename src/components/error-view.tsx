"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { CropMarks } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] px-4 py-10 sm:px-8">
      <div className="relative flex w-full flex-col items-start gap-4 rounded-lg border border-dashed px-6 py-12 sm:px-10">
        <CropMarks />
        <span className="label-meta text-destructive">Playback error</span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-medium tracking-tight">Something went wrong loading this view</h2>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Your work is safe. Try again, and if it keeps happening, share the reference below with support.
          </p>
        </div>
        {error.digest && <code className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">ref {error.digest}</code>}
        <Button onClick={reset} variant="outline">
          <RotateCcw data-icon="inline-start" /> Try again
        </Button>
      </div>
    </div>
  );
}
