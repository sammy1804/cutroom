"use client";

import { Player, type PlayerRef } from "@remotion/player";
import Link from "next/link";
import { forwardRef, useMemo, useState } from "react";
import { Check, ChefHat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecComposition } from "@/lib/creative-spec/composition";
import { specDimensions, totalFrames, type CreativeSpecDoc } from "@/lib/creative-spec/schema";
import { suggest } from "@/lib/creative-spec/suggest";

/**
 * Right panel: the live preview of the stack, and Sous chef, which offers
 * small deterministic fixes you keep or cut. Nothing here calls AI.
 */
export const SidePanel = forwardRef<PlayerRef, { spec: CreativeSpecDoc | null; canEdit: boolean; designHref: string; brainHref: string | null; onEdit: (next: CreativeSpecDoc) => void }>(function SidePanel(
  { spec, canEdit, designHref, brainHref, onEdit },
  player,
) {
  const [cut, setCut] = useState<Set<string>>(new Set());
  const ideas = useMemo(() => (spec ? suggest(spec).filter((s) => !cut.has(s.id)) : []), [spec, cut]);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-sidebar" aria-label="Preview and suggestions">
      <div className="space-y-2 p-3">
        {spec ? (
          <>
            <div className="mx-auto overflow-hidden rounded-lg bg-black shadow-card" style={{ maxWidth: spec.aspect === "9:16" ? 220 : "100%" }}>
              <Player
                ref={player}
                component={SpecComposition}
                inputProps={{ spec }}
                durationInFrames={totalFrames(spec)}
                fps={spec.fps}
                compositionWidth={specDimensions(spec).width}
                compositionHeight={specDimensions(spec).height}
                style={{ width: "100%", aspectRatio: `${specDimensions(spec).width} / ${specDimensions(spec).height}` }}
                controls
                loop
                acknowledgeRemotionLicense
              />
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={designHref}>Open the full editor</Link>
            </Button>
          </>
        ) : (
          <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground shadow-card">The preview appears once the stack has scenes.</p>
        )}
      </div>

      <section className="space-y-2 border-t p-3" aria-labelledby="souschef">
        <h2 id="souschef" className="flex items-center gap-1.5 text-[14px] font-semibold">
          <ChefHat className="size-4" aria-hidden /> Sous chef
        </h2>
        {!spec ? (
          <p className="text-sm text-muted-foreground">Suggestions show up as you build.</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to suggest right now. Looking good.</p>
        ) : (
          <ul className="space-y-2" aria-live="polite">
            {ideas.map((s) => (
              <li key={s.id} className="rounded-lg bg-card p-3 shadow-card">
                <p className="text-[14px] font-medium">{s.title}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{s.why}</p>
                {canEdit && (
                  <div className="mt-2 flex gap-1.5">
                    <Button size="xs" onClick={() => onEdit(s.apply(spec))}>
                      <Check data-icon="inline-start" /> Keep
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setCut((c) => new Set(c).add(s.id))}>
                      <X data-icon="inline-start" /> Cut
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {brainHref && (
          <Link href={brainHref} className="block pt-1 text-[13px] text-tally underline-offset-4 hover:underline">
            Want bigger ideas? Brainstorm with Brain →
          </Link>
        )}
      </section>
    </aside>
  );
});
