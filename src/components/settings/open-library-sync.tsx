"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useJob } from "@/hooks/use-job";
import { harvestOpenLibraryAction } from "@/server/actions/library";

interface Summary {
  total?: number;
  added?: number;
  updated?: number;
  unchanged?: number;
  retired?: number;
  results?: Summary[];
}

function describe(out: Summary | null | undefined) {
  if (!out) return null;
  const parts = out.results ?? [out];
  const sum = (k: keyof Summary) => parts.reduce((n, p) => n + (typeof p[k] === "number" ? (p[k] as number) : 0), 0);
  return `${sum("total")} items · ${sum("added")} new · ${sum("updated")} updated${sum("retired") ? ` · ${sum("retired")} retired` : ""}`;
}

/** Starts a harvest for one open source and shows its progress inline. */
export function OpenLibrarySync({ slug, source, name, disabled }: { slug: string; source: "polyhaven" | "noto-emoji"; name: string; disabled: boolean }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const job = useJob(slug, jobId);
  const running = pending || job?.status === "queued" || job?.status === "running";

  const sync = () =>
    start(async () => {
      const res = await harvestOpenLibraryAction(slug, source);
      if (!res.ok) return void toast.error(res.message);
      setJobId(res.data.jobId);
    });

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {job?.status === "running" || job?.status === "queued"
          ? `Syncing… ${job.progress}%`
          : job?.status === "failed"
            ? <span className="text-destructive">{job.error}</span>
            : job?.status === "succeeded"
              ? describe(job.output as Summary)
              : null}
      </span>
      <Button variant="outline" size="sm" onClick={sync} disabled={disabled || running} aria-label={`Sync ${name}`}>
        {running ? <Loader2 className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
        Sync
      </Button>
    </div>
  );
}
