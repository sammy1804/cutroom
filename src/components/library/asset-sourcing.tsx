"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Bookmark, Eye, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { JobProgress } from "@/components/jobs/job-progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJob } from "@/hooks/use-job";
import { saveCandidateAction, startAssetSearchAction } from "@/server/actions/creative";
import type { RankedCandidate, SourcingResult } from "@/server/agents/asset-sourcing";
import { setDragItem } from "@/lib/drag";
import { cn } from "@/lib/utils";
import { RightsSummary } from "./rights";

export interface ProjectOption {
  id: string;
  name: string;
}

/** AssetSourcingAgent UI: describe the shot, get licence-aware candidates ranked by visual fit. */
export function AssetSourcing({
  slug,
  projects,
  defaultProjectId,
  defaultMediaType = "image",
  initialJobId,
  aiEnabled,
  canEdit,
}: {
  slug: string;
  projects: ProjectOption[];
  defaultProjectId?: string;
  defaultMediaType?: "image" | "video" | "audio";
  initialJobId?: string;
  aiEnabled: boolean;
  canEdit: boolean;
}) {
  const [requirement, setRequirement] = useState("");
  const [mediaType, setMediaType] = useState(defaultMediaType);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [jobId, setJobId] = useState<string | undefined>(initialJobId);
  const [starting, startSearch] = useTransition();
  const job = useJob(slug, jobId, { refreshOnDone: false });
  const result = job?.status === "succeeded" ? (job.output as unknown as SourcingResult) : null;

  useEffect(() => setJobId(initialJobId), [initialJobId]);

  function search(text = requirement) {
    if (text.trim().length < 3) return;
    startSearch(async () => {
      const res = await startAssetSearchAction(slug, { requirement: text, mediaType, projectId: projectId || undefined });
      if (!res.ok) return void toast.error(res.message);
      setJobId(res.data.jobId);
    });
  }

  const running = job?.status === "queued" || job?.status === "running";

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="space-y-3 rounded-lg bg-card shadow-card p-4"
      >
        <Textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder={
            mediaType === "audio"
              ? "e.g. warm acoustic guitar loop, unhurried, morning feeling"
              : "e.g. A lonely person walking through a huge landscape, vertical, slow and cinematic"
          }
          rows={2}
          className="resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          aria-label="Describe what you need"
          disabled={!aiEnabled}
        />
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Select value={mediaType} onValueChange={(v) => setMediaType(v as typeof mediaType)}>
            <SelectTrigger className="h-9 w-[120px]" aria-label="Media type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Photos</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
            </SelectContent>
          </Select>
          {projects.length > 0 && (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 w-[200px]" aria-label="Project">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="submit" className="ml-auto h-9" disabled={!aiEnabled || starting || running || requirement.trim().length < 3}>
            {starting ? <Loader2 className="animate-spin" /> : <Search data-icon="inline-start" />}
            Find assets
          </Button>
        </div>
      </form>

      <JobProgress state={job} label="Searching licence-aware sources and ranking by visual fit…" />

      {result && <Results slug={slug} jobId={jobId!} result={result} projectId={projectId} canEdit={canEdit} onAgain={() => search(result.requirement)} />}
    </div>
  );
}

function Results({ slug, jobId, result, projectId, canEdit, onAgain }: { slug: string; jobId: string; result: SourcingResult; projectId: string; canEdit: boolean; onAgain: () => void }) {
  const [preview, setPreview] = useState<RankedCandidate | null>(null);
  return (
    <section className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="label-meta">Looking for</p>
            <p className="text-sm leading-relaxed">{result.plan.compositionIntent}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onAgain}>
            <RefreshCw data-icon="inline-start" /> Search again
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.plan.concepts.map((c) => (
            <span key={c} className="rounded-full border bg-background px-2.5 py-0.5 text-[13px] text-muted-foreground">
              {c}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Searched {result.searched.join(", ") || "no sources"}
          {result.unavailable.length > 0 && ` · not searched: ${result.unavailable.join(", ")} (enable or add a key in Settings → Sources)`}
        </p>
      </div>

      {result.candidates.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">No commercially usable results. Try different words or another media type.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.candidates.map((c, i) => (
            <CandidateCard key={`${c.provider}-${c.externalId}`} slug={slug} jobId={jobId} index={i} candidate={c} projectId={projectId} canEdit={canEdit} onPreview={() => setPreview(c)} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-[min(860px,calc(100%-2rem))]">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="line-clamp-2 pr-8">{preview.title}</DialogTitle>
              </DialogHeader>
              <MediaPreview candidate={preview} large />
              <p className="text-sm text-muted-foreground">{preview.reason}</p>
              <RightsSummary rights={preview.rights} detailed />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CandidateCard({ slug, jobId, index, candidate, projectId, canEdit, onPreview }: { slug: string; jobId: string; index: number; candidate: RankedCandidate; projectId: string; canEdit: boolean; onPreview: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<"approved" | "candidate" | null>(null);

  const save = (approve: boolean) =>
    startTransition(async () => {
      const res = await saveCandidateAction(slug, { jobId, index, approve, projectId: projectId || undefined });
      if (!res.ok) return void toast.error(res.message);
      setSaved(approve ? "approved" : "candidate");
      toast.success(approve ? "Added to the project" : "Saved for later");
      router.refresh();
    });

  return (
    <div
      draggable
      onDragStart={(e) => setDragItem(e, { type: "asset", id: `${candidate.provider}:${candidate.externalId}`, kind: candidate.mediaType, url: candidate.mediaUrl, name: candidate.title })}
      className="flex flex-col overflow-hidden rounded-lg bg-card shadow-card"
    >
      <button type="button" onClick={onPreview} className="relative block text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Preview ${candidate.title}`}>
        <MediaPreview candidate={candidate} />
        <span className={cn("absolute top-2.5 right-2.5 rounded-md px-2 py-0.5 font-mono text-xs font-medium backdrop-blur", candidate.score >= 70 ? "bg-tally text-tally-foreground" : "bg-black/60 text-white")}>
          {candidate.score}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <p className="line-clamp-1 font-medium">{candidate.title}</p>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{candidate.reason}</p>
        </div>
        <RightsSummary rights={candidate.rights} />
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onPreview}>
            <Eye /> Preview
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" disabled={pending || saved !== null} onClick={() => save(false)}>
                <Bookmark /> {saved === "candidate" ? "Saved" : "Save"}
              </Button>
              <Button size="sm" className="ml-auto" disabled={pending || saved === "approved"} onClick={() => save(true)}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                {saved === "approved" ? "Added" : "Add to project"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ candidate, large = false }: { candidate: RankedCandidate; large?: boolean }) {
  if (candidate.mediaType === "audio") {
    return (
      <div className={cn("flex flex-col justify-center gap-3 bg-gradient-to-br from-tally/20 to-transparent p-4", large ? "min-h-40" : "aspect-video")}>
        <div className="flex h-10 items-end gap-0.5" aria-hidden>
          {Array.from({ length: 32 }, (_, i) => (
            <span key={i} className="flex-1 rounded-sm bg-tally/70" style={{ height: `${25 + Math.abs(Math.sin(i * 1.7)) * 75}%` }} />
          ))}
        </div>
        <audio controls src={candidate.mediaUrl} className="w-full" preload="none" onClick={(e) => e.stopPropagation()} />
      </div>
    );
  }
  if (candidate.mediaType === "video" && large) {
    return <video src={candidate.mediaUrl} poster={candidate.thumbnailUrl ?? undefined} controls autoPlay muted loop className="max-h-[60dvh] w-full rounded-lg bg-black object-contain" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={(large ? candidate.mediaUrl : candidate.thumbnailUrl) ?? candidate.mediaUrl}
      alt={candidate.title}
      loading="lazy"
      className={cn("w-full bg-muted object-cover", large ? "max-h-[60dvh] rounded-lg object-contain" : "aspect-video")}
    />
  );
}
