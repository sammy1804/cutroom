"use client";

import { Check, Scissors, Unlink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ANIMATION_PRESETS, getPreset } from "@/lib/animations/presets";
import { frameSize, type BoardDoc, type BoardLink } from "@/lib/board";

/** Height of the label strip above each frame; ports sit at the middle of the frame below it. */
export const FRAME_HEADER = 30;

export function portPoints(board: Pick<BoardDoc, "aspect">, from: { x: number; y: number }, to: { x: number; y: number }) {
  const { w, h } = frameSize(board.aspect);
  return { a: { x: from.x + w, y: from.y + FRAME_HEADER + h / 2 }, b: { x: to.x, y: to.y + FRAME_HEADER + h / 2 } };
}

export function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(60, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

const TRANSITIONS = ANIMATION_PRESETS.filter((p) => p.category === "transition");

/**
 * Connections between frames. Each arrow is a cut in the video; the pill on it
 * names the transition and opens a menu to change or remove it.
 */
export function LinksLayer({
  board,
  canEdit,
  draft,
  onTransition,
  onRemove,
}: {
  board: BoardDoc;
  canEdit: boolean;
  draft: { a: { x: number; y: number }; b: { x: number; y: number } } | null;
  onTransition: (link: BoardLink, presetId: string | null) => void;
  onRemove: (link: BoardLink) => void;
}) {
  const byId = new Map(board.frames.map((f) => [f.id, f]));
  const drawn = board.links.flatMap((l) => {
    const from = byId.get(l.from);
    const to = byId.get(l.to);
    return from && to ? [{ link: l, ...portPoints(board, from, to) }] : [];
  });

  return (
    <>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--tally)" />
          </marker>
        </defs>
        {drawn.map(({ link, a, b }) => (
          <path key={link.id} d={curve(a, b)} fill="none" stroke="var(--tally)" strokeWidth={2.5} markerEnd="url(#arrowhead)" />
        ))}
        {draft && <path d={curve(draft.a, draft.b)} fill="none" stroke="var(--tally)" strokeWidth={2.5} strokeDasharray="6 6" />}
      </svg>
      {drawn.map(({ link, a, b }) => {
        const name = link.transition ? (getPreset(link.transition.presetId)?.name ?? "Transition") : "Cut";
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <div key={link.id} data-board-node className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: mid.x, top: mid.y }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!canEdit}>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  className="rounded-full border bg-background px-2.5 py-1 text-[12px] font-medium whitespace-nowrap shadow-sm hover:bg-hover"
                  aria-label={`Transition: ${name}. Change it`}
                >
                  {link.transition ? "✦ " : ""}
                  {name}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuLabel>Transition</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onTransition(link, null)}>
                  <Scissors /> Cut (no transition)
                  {!link.transition && <Check className="ml-auto" />}
                </DropdownMenuItem>
                {TRANSITIONS.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={() => onTransition(link, t.id)}>
                    {t.name}
                    {link.transition?.presetId === t.id && <Check className="ml-auto" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onRemove(link)}>
                  <Unlink /> Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </>
  );
}
