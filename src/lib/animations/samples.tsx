import type { CSSProperties } from "react";
import { AbsoluteFill } from "remotion";

/** Built-in sample content for previews, drawn as SVG/CSS so previews need no network. */

export const SAMPLE_TEXT = {
  text: "HELLO WORLD",
  line: "Made slowly.\nPoured daily.",
} as const;

export function SampleLandscape({ layers = [{}, {}, {}, {}, {}] }: { layers?: CSSProperties[] }) {
  const [sky, sun, far, mid, near] = layers;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg,#f3c58a 0%,#e08a5b 45%,#8b4d5f 100%)", ...sky }} />
      <div style={{ position: "absolute", left: "58%", top: "22%", width: 90, height: 90, borderRadius: "50%", background: "#ffe7b8", boxShadow: "0 0 60px 20px rgba(255,220,160,.55)", ...sun }} />
      <svg viewBox="0 0 800 360" preserveAspectRatio="none" style={{ position: "absolute", inset: "-5%", width: "110%", height: "110%", ...far }}>
        <path d="M0 230 L120 150 L230 215 L360 120 L500 210 L620 140 L800 220 L800 360 L0 360Z" fill="#7a4a63" opacity={0.75} />
      </svg>
      <svg viewBox="0 0 800 360" preserveAspectRatio="none" style={{ position: "absolute", inset: "-5%", width: "110%", height: "110%", ...mid }}>
        <path d="M0 270 Q160 200 320 260 T640 250 T800 240 L800 360 L0 360Z" fill="#4c2f48" />
      </svg>
      <svg viewBox="0 0 800 360" preserveAspectRatio="none" style={{ position: "absolute", inset: "-5%", width: "110%", height: "110%", ...near }}>
        <path d="M0 320 Q200 280 400 315 T800 300 L800 360 L0 360Z" fill="#26182a" />
        <g fill="#1a1020">
          <path d="M520 310 l14 -60 l14 60z" />
          <path d="M548 314 l10 -42 l10 42z" />
          <rect x="532" y="300" width="4" height="16" />
        </g>
      </svg>
    </AbsoluteFill>
  );
}

export function SampleObject({ style, tint = "#e8a33d" }: { style?: CSSProperties; tint?: string }) {
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 28,
        background: `linear-gradient(145deg, ${tint}, #8a5a1f)`,
        boxShadow: "0 30px 50px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <svg viewBox="0 0 24 24" width={54} height={54} fill="none">
        <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16" stroke="#1d1308" strokeWidth={1.8} strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.25" fill="#1d1308" />
      </svg>
    </div>
  );
}

export function Scene({ variant, style }: { variant: "a" | "b"; style?: CSSProperties }) {
  const a = variant === "a";
  return (
    <AbsoluteFill
      style={{
        background: a ? "radial-gradient(circle at 30% 30%, #3b3228, #15120f)" : "radial-gradient(circle at 70% 60%, #f1c27d, #c46b3c)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <div style={{ fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: 64, letterSpacing: "-0.04em", color: a ? "#efe6da" : "#2a160b" }}>
        {a ? "Scene A" : "Scene B"}
      </div>
      <div style={{ position: "absolute", left: 28, bottom: 22, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 14, letterSpacing: "0.1em", color: a ? "#efe6da88" : "#2a160b99" }}>
        {a ? "SHOT 01" : "SHOT 02"}
      </div>
    </AbsoluteFill>
  );
}

export const textStyle: CSSProperties = {
  fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  fontWeight: 700,
  fontSize: 68,
  letterSpacing: "-0.035em",
  lineHeight: 1.05,
  color: "#f4ede3",
  textAlign: "center",
  whiteSpace: "pre",
};
