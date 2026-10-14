import type { CSSProperties } from "react";
import { AbsoluteFill, random } from "remotion";
import { SAMPLE_TEXT, SampleLandscape, textStyle } from "./samples";
import type { RenderProps } from "./renderers";
import type { ParamValues } from "./types";

/**
 * Stop-motion and paper-cutout looks (analog animation): pieces snap on with
 * no tween, then "boil", a slight jitter that changes a few times a second
 * the way hand-placed cutouts shift between photographed frames. Pair with a
 * frame's "Motion feel: on twos / on threes" for the full stepped cadence.
 */

const num = (p: ParamValues, k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
const str = (p: ParamValues, k: string, d = "") => (typeof p[k] === "string" ? (p[k] as string) : d);
const center: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center" };

/** Index of the current "photographed" frame at `perSecond` drawings a second. */
const stepOf = (frame: number, fps: number, perSecond: number) => Math.floor((frame / fps) * perSecond);

/** A small jitter that changes once per step: the boil. */
function boil(seed: string, step: number, amount: number) {
  const r = (k: string) => (random(`${seed}-${k}-${step}`) - 0.5) * 2;
  return { x: r("x") * amount, y: r("y") * amount, rot: r("r") * amount * 0.6 };
}

/** Appear / leave timing in whole steps, so pieces pop rather than fade. */
function presence(props: RenderProps, perSecond: number) {
  const { frame, fps, params } = props;
  const t = frame / fps;
  const delay = num(params, "delay", 0);
  const leave = num(params, "leave", 0);
  const stepLen = 1 / perSecond;
  const since = Math.floor((t - delay) / stepLen);
  const until = leave > 0 ? Math.floor((leave - t) / stepLen) : Infinity;
  return { visible: since >= 0 && until > 0, since, until };
}

export function StopMotion(props: RenderProps) {
  const { frame, fps, params, config, content } = props;
  const kind = String(config.kind);
  const perSecond = num(params, "boilRate", 8);
  const k = 0.3 + (num(params, "intensity", 50) / 100) * 1.7;
  const step = stepOf(frame, fps, perSecond);
  const seed = str(params, "seed", kind);

  if (kind === "paper") {
    const base = str(params, "base", "#ede6d6");
    const turbulenceSeed = 1 + (step % 4);
    return (
      <AbsoluteFill style={{ background: base }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden>
          <filter id={`paper-${turbulenceSeed}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.05" numOctaves={3} seed={turbulenceSeed} result="fibre" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope={0.12 * k} />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter={`url(#paper-${turbulenceSeed})`} />
        </svg>
        {/* Scanner falloff at the edges, and a faint registration shift per step. */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(60,45,20,0.18) 100%)", transform: `translate(${boil(seed, step, 0.6).x}px, ${boil(seed, step, 0.6).y}px)` }} />
      </AbsoluteFill>
    );
  }

  const { visible, since, until } = presence(props, perSecond);
  if (!visible) return null;
  const j = boil(seed, step, k);
  const tilt = num(params, "tilt", 0);
  // Arriving: one oversized drawing, then settle. Leaving: one shrunk drawing.
  const pop = since === 0 ? 1.1 : since === 1 ? 0.97 : until === 1 ? 0.94 : 1;

  if (kind === "stamp") {
    const text = content?.text ?? SAMPLE_TEXT.text;
    const style = content?.style ?? { ...textStyle, color: "#1d1a16" };
    const thump = since === 0 ? 1.45 : since === 1 ? 0.92 : pop;
    return (
      <AbsoluteFill style={{ ...center, ...(content?.bare ? {} : { background: "#ede6d6" }) }}>
        <div style={{ ...style, transform: `translate(${j.x}px, ${j.y}px) rotate(${tilt + j.rot}deg) scale(${thump})`, opacity: since === 0 ? 0.85 : 1 }}>{text}</div>
      </AbsoluteFill>
    );
  }

  // Cutout: the image as a hand-cut paper piece with a hard drop shadow.
  const img = content?.node ?? <SampleLandscape />;
  return (
    <AbsoluteFill style={{ transform: `translate(${j.x}px, ${j.y}px) rotate(${tilt + j.rot}deg) scale(${pop})`, filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.22))" }}>{img}</AbsoluteFill>
  );
}
