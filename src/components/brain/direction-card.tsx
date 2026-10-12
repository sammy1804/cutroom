import type { CreativeDirection } from "@/lib/creative-types";
import { getPreset } from "@/lib/animations/presets";
import { cn } from "@/lib/utils";

/** A creative direction: name, premise, why, territory, palette and motion. */
export function DirectionCard({ direction, index, chosen, children, className }: { direction: CreativeDirection; index?: number; chosen?: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <article className={cn("flex flex-col gap-4 rounded-lg bg-card p-5 shadow-card", chosen && "ring-2 ring-tally", className)}>
      <header className="space-y-1">
        {index !== undefined && <p className="label-meta">Direction {String(index + 1).padStart(2, "0")}</p>}
        <h3 className="text-xl font-semibold tracking-tight">{direction.title}</h3>
        <p className="text-[16px] leading-relaxed">{direction.premise}</p>
      </header>
      <dl className="grid gap-2.5 text-[15px]">
        <div>
          <dt className="label-meta">Why it works</dt>
          <dd className="leading-relaxed text-muted-foreground">{direction.why}</dd>
        </div>
        <div>
          <dt className="label-meta">Looks like</dt>
          <dd className="leading-relaxed text-muted-foreground">{direction.visualTerritory}</dd>
        </div>
        <div>
          <dt className="label-meta">Story</dt>
          <dd className="leading-relaxed text-muted-foreground">{direction.storytelling}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex" aria-label={`Palette ${direction.palette.join(", ")}`}>
          {direction.palette.slice(0, 5).map((c) => (
            <span key={c} className="-ml-1 size-6 rounded-full ring-2 ring-card first:ml-0" style={{ background: c }} />
          ))}
        </span>
        <span className="text-[13px] text-muted-foreground">{direction.tone}</span>
      </div>
      {direction.motion.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          Motion: {direction.motion.map((id) => getPreset(id)?.name ?? id).join(" · ")}
        </p>
      )}
      {children && <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">{children}</div>}
    </article>
  );
}
