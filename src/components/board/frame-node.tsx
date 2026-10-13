"use client";

import { Player, Thumbnail } from "@remotion/player";
import { memo, useMemo } from "react";
import { GripHorizontal } from "lucide-react";
import { frameSize, type BoardDoc, type BoardFrame } from "@/lib/board";
import { frameSpec } from "@/lib/board-place";
import { SpecComposition } from "@/lib/creative-spec/composition";
import { specDimensions } from "@/lib/creative-spec/schema";
import { cn } from "@/lib/utils";

/**
 * A frame on the board: the real scene, rendered by the same composition the
 * final video uses. It plays while selected or hovered. The dot on the right
 * starts a connection; the dot on the left is where connections arrive.
 */
export const FrameNode = memo(function FrameNode({
  board,
  frame,
  index,
  selected,
  playing,
  peerColor,
  dropHot,
  canEdit,
  onHandlePointerDown,
  onPortPointerDown,
  onSelect,
  onHover,
}: {
  board: Pick<BoardDoc, "title" | "aspect" | "style">;
  frame: BoardFrame;
  /** Position in the video (1-based), or null for a draft frame. */
  index: number | null;
  selected: boolean;
  playing: boolean;
  peerColor: string | null;
  dropHot: boolean;
  canEdit: boolean;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onPortPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const { w, h } = frameSize(board.aspect);
  const spec = useMemo(() => frameSpec(board as BoardDoc, frame), [board, frame]);
  const dims = specDimensions(spec);
  const frames = Math.max(1, Math.round(frame.scene.duration * 30));
  const text = frame.scene.elements.find((e) => e.text)?.text;

  return (
    <div
      data-frame-drop={frame.id}
      data-board-node
      className="absolute"
      style={{ left: frame.x, top: frame.y, width: w }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <div
        onPointerDown={canEdit ? onHandlePointerDown : (e) => (e.stopPropagation(), onSelect())}
        className={cn("group mb-1.5 flex h-6 items-center gap-1.5 px-0.5 text-[12px] select-none", canEdit && "cursor-grab active:cursor-grabbing")}
      >
        <span className={cn("rounded px-1.5 py-px font-medium tabular", index ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{index ? String(index).padStart(2, "0") : "Draft"}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{text || frame.scene.purpose}</span>
        <span className="tabular text-muted-foreground">{frame.scene.duration}s</span>
        <GripHorizontal className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-70" aria-hidden />
      </div>
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={`${index ? `Frame ${index}` : "Draft frame"}: ${text ?? frame.scene.purpose}. Select to edit.`}
        aria-pressed={selected}
        className={cn(
          "relative block overflow-hidden rounded-xl bg-black shadow-card ring-1 ring-black/10 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-tally",
          selected && "ring-[3px] ring-tally",
          dropHot && "ring-[3px] ring-tally ring-offset-2",
        )}
        style={{ width: w, height: h, ...(peerColor && !selected ? { boxShadow: `0 0 0 3px ${peerColor}` } : {}) }}
      >
        {playing ? (
          <Player
            component={SpecComposition}
            inputProps={{ spec }}
            durationInFrames={frames}
            fps={30}
            compositionWidth={dims.width}
            compositionHeight={dims.height}
            style={{ width: "100%", height: "100%" }}
            autoPlay
            loop
            controls={false}
            clickToPlay={false}
            acknowledgeRemotionLicense
          />
        ) : (
          <Thumbnail
            component={SpecComposition}
            inputProps={{ spec }}
            durationInFrames={frames}
            fps={30}
            compositionWidth={dims.width}
            compositionHeight={dims.height}
            frameToDisplay={Math.floor(frames * 0.75)}
            style={{ width: "100%", height: "100%" }}
          />
        )}
        {dropHot && <span className="absolute inset-x-0 bottom-0 bg-tally py-1 text-center text-[12px] font-medium text-white">Drop to add to this frame</span>}
      </button>
      {canEdit && (
        <>
          <span aria-hidden className="absolute top-[calc(50%+15px)] -left-[7px] size-3.5 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground/60" />
          <span
            role="button"
            tabIndex={-1}
            aria-label="Drag to connect to the next frame"
            onPointerDown={onPortPointerDown}
            className="absolute top-[calc(50%+15px)] -right-[9px] flex size-[18px] -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-background bg-tally shadow transition-transform hover:scale-125"
          >
            <span className="size-1.5 rounded-full bg-white" />
          </span>
        </>
      )}
    </div>
  );
});
