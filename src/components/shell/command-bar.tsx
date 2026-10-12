"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, CornerDownLeft, Loader2, Sparkles } from "lucide-react";
import { JobProgress } from "@/components/jobs/job-progress";
import { AnimationPreview } from "@/components/library/animation-preview";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useJob } from "@/hooks/use-job";
import { commandAction, type CommandResult } from "@/server/actions/creative";
import type { SourcingResult } from "@/server/agents/asset-sourcing";
import { getPreset } from "@/lib/animations/presets";
import { storageUrl } from "@/lib/drag";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Give this headline a more editorial animation",
  "Find a transition that feels liquid",
  "Find a free video of someone walking through a forest",
  "Find references with muted photography",
  "Research what competitors post on Reels",
];

/** ⌘K: one prompt that can reach every library and agent. */
export function CommandBar({ slug, open, onOpenChange, aiEnabled }: { slug: string; open: boolean; onOpenChange: (open: boolean) => void; aiEnabled: boolean }) {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const where = {
    projectId: pathname.match(/\/projects\/([^/?#]+)/)?.[1]?.replace("new", "") || undefined,
    campaignId: pathname.match(/\/campaigns\/([^/?#]+)/)?.[1],
  };

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  function run(value = text) {
    if (value.trim().length < 2 || !aiEnabled) return;
    setText(value);
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await commandAction(slug, value, where);
      if (!res.ok) return setError(res.message);
      setResult(res.data);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[12%] max-h-[80dvh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[min(720px,calc(100%-2rem))]">
        <DialogTitle className="sr-only">Ask Cutroom</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex items-center gap-3 border-b px-5"
        >
          {pending ? <Loader2 className="size-5 shrink-0 animate-spin text-tally" /> : <Sparkles className="size-5 shrink-0 text-tally" />}
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={aiEnabled ? "Ask for an animation, asset, reference or research…" : "Connect Claude (ANTHROPIC_API_KEY) to use the command bar"}
            disabled={!aiEnabled}
            className="h-16 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            aria-label="Command"
          />
          <kbd className="hidden items-center gap-1 rounded border px-1.5 py-0.5 text-[13px] text-muted-foreground sm:flex">
            <CornerDownLeft className="size-3" />
          </kbd>
        </form>

        <div className="max-h-[calc(80dvh-4rem)] overflow-y-auto p-5" aria-live="polite" aria-busy={pending}>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
          {!result && !pending && !error && (
            <div className="space-y-2">
              <p className="label-meta">Try</p>
              <ul className="space-y-1">
                {EXAMPLES.map((e) => (
                  <li key={e}>
                    <button onClick={() => run(e)} disabled={!aiEnabled} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[15px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                      {e} <ArrowRight className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pending && <p className="text-[15px] text-muted-foreground">Working out which library to search…</p>}
          {result && <Result slug={slug} result={result} onNavigate={() => onOpenChange(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Result({ slug, result, onNavigate }: { slug: string; result: CommandResult; onNavigate: () => void }) {
  const router = useRouter();
  switch (result.kind) {
    case "animations":
      return (
        <div className="space-y-4">
          <Tag>Animation library</Tag>
          <p className="text-[15px] text-muted-foreground">{result.result.interpretation}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.result.recommendations.slice(0, 4).map((r) => (
              <div key={r.presetId} className="overflow-hidden rounded-xl border">
                <AnimationPreview layers={[{ presetId: r.presetId, params: r.params }]} mode="loop" />
                <div className="space-y-1 p-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.why}</p>
                </div>
              </div>
            ))}
          </div>
          {result.result.combinations.map((c) => (
            <div key={c.name} className="rounded-xl border p-4">
              <p className="font-medium">{c.name}</p>
              <p className="font-mono text-sm text-tally">{c.layers.map((l) => getPreset(l.presetId)?.name).join(" + ")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.why}</p>
            </div>
          ))}
          <GoTo href={`/w/${slug}/library?tab=animations`} label="Open the animation library" onNavigate={onNavigate} />
        </div>
      );
    case "assets":
      return <AssetResult slug={slug} result={result} onNavigate={onNavigate} />;
    case "references":
      return (
        <div className="space-y-4">
          <Tag>Reference library</Tag>
          {result.items.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">No saved references match “{result.query}”. Capture some from a project&apos;s References tab.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {result.items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onNavigate();
                    router.push(r.projectId ? `/w/${slug}/projects/${r.projectId}?tab=references` : `/w/${slug}/library?tab=references`);
                  }}
                  className="overflow-hidden rounded-lg border text-left hover:border-foreground/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.imageKey && <img src={storageUrl(r.imageKey)!} alt="" className="aspect-video w-full object-cover object-top" />}
                  <p className="line-clamp-2 p-2 text-sm">{r.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    case "research":
      return <ResearchResult slug={slug} result={result} onNavigate={onNavigate} />;
    case "navigate":
      return <GoTo href={result.href} label={result.label} onNavigate={onNavigate} />;
    case "answer":
      return <p className="text-[15px] leading-relaxed">{result.text}</p>;
  }
}

function AssetResult({ slug, result, onNavigate }: { slug: string; result: Extract<CommandResult, { kind: "assets" }>; onNavigate: () => void }) {
  const job = useJob(slug, result.jobId, { refreshOnDone: false });
  const done = job?.status === "succeeded" ? (job.output as unknown as SourcingResult) : null;
  return (
    <div className="space-y-4">
      <Tag>Asset sourcing</Tag>
      <p className="text-[15px] text-muted-foreground">Searching for “{result.query}” across licence-aware sources.</p>
      <JobProgress state={job} label="Expanding into visual concepts and ranking results…" />
      {done && (
        <div className="grid grid-cols-3 gap-2">
          {done.candidates.slice(0, 6).map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c.externalId} src={c.thumbnailUrl ?? c.mediaUrl} alt={c.title} className="aspect-video w-full rounded-md border object-cover" />
          ))}
        </div>
      )}
      <GoTo href={`/w/${slug}/library?tab=${done?.plan.mediaType === "audio" ? "audio" : "free"}&job=${result.jobId}${result.projectId ? `&project=${result.projectId}` : ""}`} label="Review and add results" onNavigate={onNavigate} />
    </div>
  );
}

function ResearchResult({ slug, result, onNavigate }: { slug: string; result: Extract<CommandResult, { kind: "research" }>; onNavigate: () => void }) {
  const job = useJob(slug, result.jobId);
  return (
    <div className="space-y-4">
      <Tag>Research brain</Tag>
      <JobProgress state={job} label="Researching the web for this campaign…" />
      {job?.status === "succeeded" && <p className="text-[15px]">Research is ready.</p>}
      <GoTo href={`/w/${slug}/projects/${result.projectId}/campaigns/${result.campaignId}#research`} label="Open the campaign research" onNavigate={onNavigate} />
    </div>
  );
}

const Tag = ({ children }: { children: React.ReactNode }) => <span className="inline-block rounded-full bg-tally/15 px-2.5 py-0.5 text-xs font-medium text-tally">{children}</span>;

function GoTo({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline")}>
      {label} <ArrowRight className="size-4" />
    </Link>
  );
}
