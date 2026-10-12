"use client";

import { useState, useTransition } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { JobProgress } from "@/components/jobs/job-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJob } from "@/hooks/use-job";
import { exploreResearchAction } from "@/server/actions/creative";

export function ExploreResearch({ slug, aiEnabled }: { slug: string; aiEnabled: boolean }) {
  const [q, setQ] = useState("");
  const [jobId, setJobId] = useState<string>();
  const [pending, startTransition] = useTransition();
  const job = useJob(slug, jobId);
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await exploreResearchAction(slug, q);
            if (!res.ok) return void toast.error(res.message);
            setJobId(res.data.jobId);
            setQ("");
          });
        }}
        className="flex flex-col gap-2 rounded-xl bg-card p-1.5 shadow-card sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-2">
          <ScanSearch className="ml-3 size-5 shrink-0 text-tally" />
          <label htmlFor="explore-q" className="sr-only">
            Research question
          </label>
          <Input
            id="explore-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={!aiEnabled}
            placeholder={aiEnabled ? "Show me how Apple launches products · What are sustainable brands doing on Reels?" : "Connect Claude to research"}
            className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <Button type="submit" size="lg" disabled={!aiEnabled || pending || q.trim().length < 5}>
          {pending && <Loader2 className="animate-spin" />}
          Research
        </Button>
      </form>
      <JobProgress state={job} label="Searching the web and writing it up… a minute or two." />
    </div>
  );
}
