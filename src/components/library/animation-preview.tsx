"use client";

import { Player, Thumbnail, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { AnimationStack, PREVIEW, type AnimationLayer } from "@/lib/animations/composition";
import { getPreset } from "@/lib/animations/presets";
import { cn } from "@/lib/utils";

interface PreviewProps {
  layers: AnimationLayer[];
  text?: string;
  className?: string;
  /** "hover": static poster that plays while hovered. "loop": always plays. */
  mode?: "hover" | "loop";
  controls?: boolean;
}

/** Remotion-rendered preview of one or more animation presets. */
export function AnimationPreview({ layers, text, className, mode = "hover", controls = false }: PreviewProps) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(mode === "loop");
  const ref = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null);
  const inputProps = { layers, text };
  const durationInFrames = Math.max(PREVIEW.durationInFrames, ...layers.map((l) => getPreset(l.presetId)?.preview.durationInFrames ?? 0));

  // Only mount Remotion once the card is near the viewport.
  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (mode !== "hover") return;
    if (hovered) {
      player.current?.seekTo(0);
      player.current?.play();
    }
  }, [hovered, mode]);

  // Respect "reduce motion": show the still poster unless the viewer asks to play (hover/focus).
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const playing = (mode === "loop" && !reduced) || hovered;

  return (
    <div
      ref={ref}
      className={cn("relative aspect-video overflow-hidden bg-[#12100e]", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {visible &&
        (playing ? (
          <Player
            ref={player}
            component={AnimationStack}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={PREVIEW.fps}
            compositionWidth={PREVIEW.width}
            compositionHeight={PREVIEW.height}
            style={{ width: "100%", height: "100%" }}
            autoPlay
            loop
            controls={controls || (mode === "loop" && reduced)}
            clickToPlay={controls}
            acknowledgeRemotionLicense
          />
        ) : (
          <Thumbnail
            component={AnimationStack}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={PREVIEW.fps}
            compositionWidth={PREVIEW.width}
            compositionHeight={PREVIEW.height}
            frameToDisplay={layers.length === 1 ? (getPreset(layers[0]!.presetId)?.preview.posterFrame ?? 70) : 70}
            style={{ width: "100%", height: "100%" }}
          />
        ))}
    </div>
  );
}
