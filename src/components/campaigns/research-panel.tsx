"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { JobProgress } from "@/components/jobs/job-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJob } from "@/hooks/use-job";
import { startResearchAction } from "@/server/actions/creative";
import { researchIdeaAction } from "@/server/actions/journey";
import type { ResearchReport } from "@/lib/skill-types";

export function ResearchPanel({
  slug,
  campaignId,
  projectId,
  report,
  activeJobId,
  lastError,
  aiEnabled,
  canRun,
  ranAt,
}: {
  slug: string;
  /** Research a campaign brief, or (with projectId) a project's idea. */
  campaignId?: string;
  projectId?: string;
  report: ResearchReport | null;
  activeJobId?: string;
  lastError?: string | null;
  aiEnabled: boolean;
  canRun: boolean;
  ranAt?: string;
}) {
  const [focus, setFocus] = useState("");
  const [jobId, setJobId] = useState(activeJobId);
  const [pending, startTransition] = useTransition();
  const job = useJob(slug, jobId);
  const running = job?.status === "queued" || job?.status === "running";

  return (
    <div className="space-y-6">
      {canRun && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = campaignId ? await startResearchAction(slug, campaignId, focus) : await researchIdeaAction(slug, projectId!, focus);
              if (!res.ok) return void toast.error(res.message);
              setJobId(res.data.jobId);
            });
          }}
          className="flex flex-col gap-2 rounded-lg bg-card shadow-card p-1.5 sm:flex-row"
        >
          <div className="flex flex-1 items-center gap-2">
            <ScanSearch className="ml-3 size-5 shrink-0 text-tally" />
            <Input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional focus: “what do competitors' Reels look like?”"
              className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
              disabled={!aiEnabled || running}
              aria-label="Research focus"
            />
          </div>
          <Button type="submit" size="lg" disabled={!aiEnabled || pending || running}>
            {pending && <Loader2 className="animate-spin" />}
            {report ? "Research again" : "Run research"}
          </Button>
        </form>
      )}
      <JobProgress state={job} label="Searching the web, reading sources and writing it up. This takes a minute or two…" />
      {!job && lastError && <JobProgress state={{ status: "failed", progress: 0, error: lastError, output: null }} label="" />}

      {report && !running && <Report report={report} ranAt={ranAt} />}
    </div>
  );
}

function Report({ report, ranAt }: { report: ResearchReport; ranAt?: string }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2 rounded-2xl border bg-card p-6">
        <p className="label-meta">Summary{ranAt ? ` · ${ranAt}` : ""}</p>
        <p className="max-w-[75ch] text-[15px] leading-relaxed">{report.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Audience">
          {report.audience.map((a) => (
            <li key={a.insight} className="space-y-1">
              <p className="font-medium">{a.insight}</p>
              <p className="text-muted-foreground">→ {a.implication}</p>
            </li>
          ))}
        </Block>
        <Block title="Trends">
          {report.trends.map((t) => (
            <li key={t.trend} className="space-y-1">
              <p className="font-medium">{t.trend}</p>
              <p className="text-muted-foreground">{t.evidence}</p>
            </li>
          ))}
        </Block>
      </div>

      <Block title="Competitors">
        {report.competitors.map((c) => (
          <li key={c.name} className="grid gap-1 sm:grid-cols-[180px_1fr]">
            <a href={c.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
              {c.name}
            </a>
            <div className="space-y-1">
              <p>{c.approach}</p>
              <p className="text-tally">Opening: {c.opening}</p>
            </div>
          </li>
        ))}
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Hooks">
          {report.hooks.map((h) => (
            <li key={h} className="text-[15px]">
              “{h}”
            </li>
          ))}
        </Block>
        <Block title="Visual directions">
          {report.visualDirections.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </Block>
      </div>

      <details className="rounded-xl border">
        <summary className="cursor-pointer px-5 py-3.5 text-sm font-medium">Sources ({report.sources.length})</summary>
        <ul className="space-y-1.5 border-t px-5 py-4 text-sm">
          {report.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                {s.title || s.url} <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="label-meta">{title}</h3>
      <ul className="space-y-4 rounded-lg bg-card shadow-card p-5 text-sm leading-relaxed">{children}</ul>
    </section>
  );
}
