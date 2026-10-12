import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The production flow every campaign moves through:
 * brief → research → references → brand/DNA → assets → animation → creative spec → editor → final video.
 */
export const PIPELINE_STAGES = [
  { id: "brief", label: "Brief", detail: "Goals, audience, channels", phase: 1 },
  { id: "research", label: "Research", detail: "Audience, competitors, trends", phase: 2 },
  { id: "references", label: "References", detail: "Visual research", phase: 2 },
  { id: "dna", label: "CreativeDNA", detail: "Direction from references", phase: 2 },
  { id: "assets", label: "Assets", detail: "Licence-aware sourcing", phase: 2 },
  { id: "animation", label: "Animation", detail: "Motion presets → spec", phase: 2 },
  { id: "edit", label: "Edit", detail: "Remotion editor", phase: 3 },
  { id: "render", label: "Render", detail: "Exports for every format", phase: 4 },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]["id"];
export type StageState = "done" | "ready" | "locked";

export function PipelinePreview({ className, states = {}, hrefs = {} }: { className?: string; states?: Partial<Record<StageId, StageState>>; hrefs?: Partial<Record<StageId, string>> }) {
  return (
    <ol className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 xl:grid-cols-8", className)}>
      {PIPELINE_STAGES.map((stage, i) => {
        const state: StageState = states[stage.id] ?? (stage.phase <= 2 ? "ready" : "locked");
        const href = hrefs[stage.id];
        const inner = (
          <>
            <div className="flex items-center justify-between">
              <span className="tabular text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              {state === "done" ? <Check className="size-4 text-success" /> : state === "ready" ? <span className="size-2 rounded-full bg-tally" /> : <Lock className="size-3.5 text-muted-foreground/60" />}
            </div>
            <div className="space-y-0.5">
              <p className={cn("text-sm font-medium", state === "locked" && "text-muted-foreground")}>{stage.label}</p>
              <p className="text-xs leading-snug text-muted-foreground">{state === "locked" ? `Phase ${stage.phase}` : stage.detail}</p>
            </div>
          </>
        );
        const cls = cn("flex h-full flex-col gap-3 bg-card p-3.5", state === "locked" && "bg-card/60");
        return (
          <li key={stage.id}>
            {href && state !== "locked" ? (
              <Link href={href} className={cn(cls, "transition-colors hover:bg-muted/50")}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
