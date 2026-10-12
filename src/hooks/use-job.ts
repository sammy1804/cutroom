"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { jobStatusAction } from "@/server/actions/creative";

export interface JobState {
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
  error: string | null;
  output: Record<string, unknown> | null;
}

/** Polls a background job until it finishes, then refreshes server components. */
export function useJob(slug: string, jobId: string | null | undefined, opts: { refreshOnDone?: boolean } = {}) {
  const router = useRouter();
  const [state, setState] = useState<JobState | null>(null);
  const refreshOnDone = opts.refreshOnDone ?? true;

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setState({ status: "queued", progress: 0, error: null, output: null });

    const poll = async () => {
      const res = await jobStatusAction(slug, jobId);
      if (cancelled) return;
      if (!res.ok) {
        setState({ status: "failed", progress: 0, error: res.message, output: null });
        return;
      }
      setState(res.data as JobState);
      if (res.data.status === "queued" || res.data.status === "running") timer = setTimeout(poll, 1800);
      else if (refreshOnDone) router.refresh();
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, jobId, refreshOnDone, router]);

  return state;
}
