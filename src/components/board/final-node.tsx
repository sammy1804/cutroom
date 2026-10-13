"use client";

import { Player } from "@remotion/player";
import Link from "next/link";
import { memo, useMemo } from "react";
import { Clapperboard } from "lucide-react";
import { compileSpec, frameSize, mainChain, type BoardDoc } from "@/lib/board";
import { SpecComposition } from "@/lib/creative-spec/composition";
import { specDimensions, totalFrames } from "@/lib/creative-spec/schema";
import { curve, FRAME_HEADER } from "./links-layer";

/**
 * The output of the board, Flora-style: once two or more frames are connected,
 * the combined video appears to the right of the last frame, joined by a
 * dashed line, with every frame and transition playing in order.
 */
export const FinalNode = memo(function FinalNode({ board, finalHref }: { board: BoardDoc; finalHref: string }) {
  const spec = useMemo(() => compileSpec(board), [board]);
  const chain = useMemo(() => mainChain(board), [board]);
  const last = board.frames.find((f) => f.id === chain[chain.length - 1]);
  if (!spec || !last || chain.length < 2) return null;

  const { w, h } = frameSize(board.aspect);
  const scale = 1.35;
  const box = { w: Math.round(w * scale), h: Math.round(h * scale) };
  const x = last.x + w + 200;
  const y = last.y + FRAME_HEADER + h / 2 - box.h / 2 - 34;
  const dims = specDimensions(spec);
  const seconds = spec.scenes.reduce((n, s) => n + s.duration, 0);
  const from = { x: last.x + w + 10, y: last.y + FRAME_HEADER + h / 2 };
  const to = { x, y: y + 34 + box.h / 2 };

  return (
    <>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
        <path d={curve(from, to)} fill="none" stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="4 6" />
      </svg>
      <section data-board-node aria-label={`Final video: ${spec.scenes.length} frames, ${seconds.toFixed(1)} seconds`} className="absolute" style={{ left: x, top: y, width: box.w }}>
        <div className="mb-2 flex h-7 items-center gap-1.5 text-[13px]">
          <span className="flex items-center gap-1 rounded-md bg-tally px-2 py-0.5 font-semibold text-white">
            <Clapperboard className="size-3.5" aria-hidden /> Final video
          </span>
          <span className="tabular text-muted-foreground">
            {spec.scenes.length} frames · {seconds.toFixed(1)}s
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl bg-black shadow-xl ring-2 ring-tally" onPointerDown={(e) => e.stopPropagation()}>
          <Player
            component={SpecComposition}
            inputProps={{ spec }}
            durationInFrames={totalFrames(spec)}
            fps={spec.fps}
            compositionWidth={dims.width}
            compositionHeight={dims.height}
            style={{ width: box.w, height: box.h }}
            controls
            loop
            acknowledgeRemotionLicense
          />
        </div>
        <Link href={finalHref} onPointerDown={(e) => e.stopPropagation()} className="mt-2 block text-center text-[13px] font-medium text-tally hover:underline">
          Check, credit and save →
        </Link>
      </section>
    </>
  );
});
