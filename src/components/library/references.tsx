"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ExternalLink, Globe, Loader2, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { JobProgress } from "@/components/jobs/job-progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useJob } from "@/hooks/use-job";
import { captureReferenceAction, deleteReferenceAction, setReferenceStatusAction } from "@/server/actions/creative";
import type { ReferenceAnalysis } from "@/lib/creative-types";
import { setDragItem, storageUrl } from "@/lib/drag";
import { cn } from "@/lib/utils";

export interface ReferenceSummary {
  id: string;
  title: string;
  url: string;
  imageKey: string | null;
  rank: number;
  status: "pending" | "approved" | "rejected";
  tags: string[];
  analysis: ReferenceAnalysis | null;
  parentId: string | null;
  /** 1-based position among approved references, as Claude sees them. */
  number?: number;
}

/** BrowserResearchAgent UI: paste an approved URL, get analysed, ranked references. */
export function ReferenceCapture({ slug, projectId, campaignId, aiEnabled, suggestions = [] }: { slug: string; projectId: string; campaignId?: string; aiEnabled: boolean; suggestions?: { url: string; why: string }[] }) {
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string>();
  const [pending, startTransition] = useTransition();
  const job = useJob(slug, jobId);

  const capture = (target = url) =>
    startTransition(async () => {
      const res = await captureReferenceAction(slug, { url: target, projectId, campaignId });
      if (!res.ok) return void toast.error(res.message);
      setJobId(res.data.jobId);
      setUrl("");
    });

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          capture();
        }}
        className="flex flex-col gap-2 rounded-lg bg-card shadow-card p-1.5 sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-2">
          <Globe className="ml-3 size-5 shrink-0 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… a page on an approved source, or the brand's own site"
            className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Page to capture"
            inputMode="url"
            disabled={!aiEnabled}
          />
        </div>
        <Button type="submit" size="lg" disabled={!aiEnabled || pending || !url.trim()}>
          {pending && <Loader2 className="animate-spin" />}
          Capture & analyse
        </Button>
      </form>
      <JobProgress state={job} label="Rendering the page, capturing screenshots and analysing composition…" />
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="label-meta">Suggested by research</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((s) => (
              <button
                key={s.url}
                title={s.why}
                onClick={() => capture(s.url)}
                disabled={!aiEnabled || pending}
                className="max-w-[260px] truncate rounded-full border px-3 py-1 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              >
                {s.url.replace(/^https?:\/\/(www\.)?/, "")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReferenceGrid({ slug, references, canEdit, emptyText }: { slug: string; references: ReferenceSummary[]; canEdit: boolean; emptyText: string }) {
  const [open, setOpen] = useState<ReferenceSummary | null>(null);
  if (references.length === 0) return <p className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">
        {references.map((r) => (
          <ReferenceCard key={r.id} slug={slug} reference={r} canEdit={canEdit} onOpen={() => setOpen(r)} />
        ))}
      </div>
      <ReferenceDialog reference={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ReferenceCard({ slug, reference: r, canEdit, onOpen }: { slug: string; reference: ReferenceSummary; canEdit: boolean; onOpen: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.message);
      toast.success(msg);
      router.refresh();
    });
  const img = storageUrl(r.imageKey);

  return (
    <div
      draggable
      onDragStart={(e) => setDragItem(e, { type: "reference", id: r.id, title: r.title, imageUrl: img })}
      className={cn("break-inside-avoid overflow-hidden rounded-lg bg-card shadow-card", r.status === "rejected" && "opacity-55")}
    >
      <button type="button" onClick={onOpen} className="relative block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt={r.title} loading="lazy" className="max-h-[420px] w-full bg-muted object-cover object-top" />}
        <span className="absolute top-2.5 left-2.5 flex gap-1.5">
          {r.number && <span className="rounded-md bg-tally px-2 py-0.5 font-mono text-xs font-semibold text-tally-foreground">REF {String(r.number).padStart(2, "0")}</span>}
          <span className="rounded-md bg-black/65 px-2 py-0.5 font-mono text-xs text-white backdrop-blur">{r.rank}</span>
        </span>
        <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/65 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white uppercase backdrop-blur">Reference only</span>
      </button>
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="font-medium leading-snug">{r.title}</p>
          {r.analysis?.summary && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{r.analysis.summary}</p>}
        </div>
        {r.analysis?.palette && r.analysis.palette.length > 0 && (
          <div className="flex gap-1">
            {r.analysis.palette.slice(0, 6).map((c) => (
              <span key={c} title={c} className="size-4 rounded-[4px] ring-1 ring-black/10 ring-inset" style={{ background: c }} />
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex items-center gap-1 border-t pt-3">
            {r.status !== "approved" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setReferenceStatusAction(slug, r.id, "approved"), "Approved: it will feed the CreativeDNA")}>
                <Check /> Approve
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setReferenceStatusAction(slug, r.id, "pending"), "Moved back to review")}>
                <Undo2 /> Unapprove
              </Button>
            )}
            {r.status !== "rejected" && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setReferenceStatusAction(slug, r.id, "rejected"), "Rejected")}>
                <X /> Reject
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" className="ml-auto" disabled={pending} aria-label="Delete reference" onClick={() => act(() => deleteReferenceAction(slug, r.id), "Reference deleted")}>
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceDialog({ reference: r, onClose }: { reference: ReferenceSummary | null; onClose: () => void }) {
  const a = r?.analysis;
  return (
    <Dialog open={Boolean(r)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[min(980px,calc(100%-2rem))]">
        {r && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8 text-xl">{r.title}</DialogTitle>
              <DialogDescription asChild>
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground">
                  {r.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
                </a>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.imageKey && <img src={storageUrl(r.imageKey)!} alt={r.title} className="max-h-[70dvh] w-full rounded-lg border object-cover object-top" />}
              {a && (
                <div className="space-y-5 text-sm">
                  <p className="leading-relaxed">{a.summary}</p>
                  <div className="space-y-2">
                    <p className="label-meta">What we can learn</p>
                    <ul className="space-y-1.5">
                      {a.learnings.map((l) => (
                        <li key={l} className="flex gap-2">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-tally" />
                          {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-2.5">
                    {(
                      [
                        ["Composition", a.composition],
                        ["Typography", a.typography],
                        ["Motion", a.motion],
                        ["Art direction", a.artDirection],
                        ["Photography", a.photography],
                        ["Relevance", `${a.relevance}/100 · ${a.relevanceReason}`],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="leading-relaxed">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
