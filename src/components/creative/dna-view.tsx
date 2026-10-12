import Link from "next/link";
import { AnimationPreview } from "@/components/library/animation-preview";
import type { CreativeDNA } from "@/lib/creative-types";
import { getPreset } from "@/lib/animations/presets";
import { storageUrl } from "@/lib/drag";

const DIMENSION_LABEL: Record<string, string> = {
  typography: "Typography",
  color: "Colour",
  photography: "Photography",
  motion: "Motion",
  composition: "Composition",
  texture: "Texture",
  tone: "Tone",
};

/** CreativeDNA: what we learned from the references, not just what we collected. */
export function DnaView({ slug, dna, refs, updatedAt }: { slug: string; dna: CreativeDNA; refs: { id: string; title: string; imageKey: string | null; number: number }[]; updatedAt: Date }) {
  const byId = new Map(refs.map((r) => [r.id, r]));
  const tag = (id: string) => {
    const r = byId.get(id);
    return r ? `REF ${String(r.number).padStart(2, "0")}` : null;
  };

  return (
    <div className="space-y-10">
      <div className="space-y-3 rounded-2xl border bg-gradient-to-br from-tally/10 via-card to-card p-6 sm:p-8">
        <p className="label-meta">CreativeDNA · updated {updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
        <p className="max-w-[40ch] text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">{dna.headline}</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">What we learned from the references</h3>
        <ol className="divide-y rounded-xl border">
          {dna.learnedFrom.map((l) => {
            const r = byId.get(l.referenceId);
            return (
              <li key={l.referenceId} className="grid grid-cols-[72px_1fr] items-center gap-4 p-4 sm:grid-cols-[88px_120px_1fr]">
                <span className="font-mono text-sm font-semibold text-tally">{tag(l.referenceId)}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r?.imageKey ? <img src={storageUrl(r.imageKey)!} alt="" className="hidden aspect-video w-full rounded-md border object-cover object-top sm:block" /> : <span className="hidden sm:block" />}
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{r?.title}</p>
                  <p className="leading-relaxed">→ {l.learned}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">Direction</h3>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
          {dna.dimensions.map((d) => (
            <div key={d.key} className="space-y-2 bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="label-meta">{DIMENSION_LABEL[d.key] ?? d.key}</span>
                <span className="flex gap-1">
                  {d.evidence.map((id) => (
                    <span key={id} className="rounded bg-muted px-1.5 text-[13px] text-muted-foreground">
                      {tag(id)}
                    </span>
                  ))}
                </span>
              </div>
              <p className="leading-relaxed">{d.direction}</p>
            </div>
          ))}
        </div>
        {dna.avoid.length > 0 && (
          <div className="rounded-xl border border-dashed p-5">
            <p className="label-meta mb-2">Avoid</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {dna.avoid.map((a) => (
                <li key={a}>— {a}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {dna.suggestedAnimations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Motion that fits</h3>
            <Link href={`/w/${slug}/library?tab=animations`} className="text-sm text-muted-foreground hover:text-foreground">
              Open the animation library
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dna.suggestedAnimations.map((id) => {
              const p = getPreset(id);
              if (!p) return null;
              return (
                <div key={id} className="overflow-hidden rounded-lg bg-card shadow-card">
                  <AnimationPreview layers={[{ presetId: id }]} />
                  <div className="p-4">
                    <p className="font-medium">{p.name}</p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{p.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
