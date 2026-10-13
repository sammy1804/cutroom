"use client";

import { Player } from "@remotion/player";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChefHat, Film, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compileSpec, opsFromSpec, type BoardDoc, type BoardOp } from "@/lib/board";
import { SpecComposition } from "@/lib/creative-spec/composition";
import { specDimensions, totalFrames } from "@/lib/creative-spec/schema";
import { suggest } from "@/lib/creative-spec/suggest";
import { cn } from "@/lib/utils";
import { CommentsPanel, type Thread } from "./comments";

/**
 * Right panel. Video: the connected chain played as the final piece, plus
 * Sous chef's keep-or-cut fixes. Comments: every thread on the board.
 */
export function SidePanel({
  board,
  canEdit,
  commit,
  threads,
  tab,
  setTab,
  finalHref,
  brainHref,
  onJump,
}: {
  board: BoardDoc;
  canEdit: boolean;
  commit: (ops: BoardOp[]) => void;
  threads: Thread[];
  tab: "video" | "comments";
  setTab: (t: "video" | "comments") => void;
  finalHref: string;
  brainHref: string | null;
  onJump: (t: Thread) => void;
}) {
  const spec = useMemo(() => compileSpec(board), [board]);
  const [cut, setCut] = useState<Set<string>>(new Set());
  const ideas = useMemo(() => (spec ? suggest(spec).filter((s) => !cut.has(s.id)) : []), [spec, cut]);
  const open = threads.filter((t) => !t.root.resolved).length;
  const drafts = board.frames.length - (spec?.scenes.length ?? 0);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar" aria-label="Video and comments">
      <div className="flex gap-1 border-b p-2" role="tablist">
        {(
          [
            ["video", "Video", Film],
            ["comments", `Comments${open ? ` · ${open}` : ""}`, MessageCircle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] text-muted-foreground hover:bg-hover", tab === id && "bg-background font-medium text-foreground shadow-sm")}
          >
            <Icon className="size-3.5" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "comments" ? (
          <CommentsPanel threads={threads} onJump={onJump} />
        ) : (
          <>
            <div className="space-y-2 p-3">
              {spec ? (
                <>
                  <div className="mx-auto overflow-hidden rounded-lg bg-black shadow-card" style={{ maxWidth: spec.aspect === "9:16" ? 210 : "100%" }}>
                    <Player
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
                  <p className="text-center text-[13px] text-muted-foreground">
                    {spec.scenes.length} frame{spec.scenes.length > 1 ? "s" : ""} · {spec.scenes.reduce((n, s) => n + s.duration, 0).toFixed(1)}s · {spec.aspect}
                    {drafts > 0 && ` · ${drafts} draft${drafts > 1 ? "s" : ""} not connected`}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={finalHref}>Check and finish →</Link>
                  </Button>
                </>
              ) : (
                <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground shadow-card">Add a frame and the video plays here. Connect frames to make it longer.</p>
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
                          <Button size="xs" onClick={() => commit(opsFromSpec(board, s.apply(spec)))}>
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
          </>
        )}
      </div>
    </aside>
  );
}
