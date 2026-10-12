import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, random } from "remotion";
import { bounceDrop, clamp01, ease, lerp, localProgress } from "./easing";
import { SAMPLE_TEXT, SampleLandscape, SampleObject, textStyle } from "./samples";
import type { RenderProps } from "./renderers";
import type { ParamValues } from "./types";

/**
 * Second renderer set: extra text/image/object effects, backgrounds and the
 * video "components" (captions, lower thirds, CTAs…). Same contract as
 * renderers.tsx — pure functions of the frame.
 */

const num = (p: ParamValues, k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
const str = (p: ParamValues, k: string, d = "") => (typeof p[k] === "string" ? (p[k] as string) : d);
const bool = (p: ParamValues, k: string, d = false) => (typeof p[k] === "boolean" ? (p[k] as boolean) : d);
const amp = (p: ParamValues) => 0.3 + (num(p, "intensity", 50) / 100) * 1.4;
const center: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center" };
const sans = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const progress = ({ frame, fps, params }: RenderProps, fallbackDur = 0.8, easing?: string) =>
  ease(easing ?? str(params, "easing", "easeOut"), localProgress(frame, fps, num(params, "delay", 0.1), num(params, "duration", fallbackDur)));
const darkStage: CSSProperties = { background: "radial-gradient(circle at 50% 35%, #2a2520, #0f0d0b)" };

/* ─── Text effects ──────────────────────────────────────────────────────── */

export function TextFx(props: RenderProps) {
  const { frame, fps, params, config, content } = props;
  const text = content?.text ?? SAMPLE_TEXT.text;
  const e = progress(props);
  const fx = String(config.fx);
  const base: CSSProperties = { ...textStyle, position: "relative", ...content?.style };
  let node: ReactNode = null;

  switch (fx) {
    case "glitch": {
      const settle = 1 - e;
      const jitter = (seed: string) => (random(`${seed}-${Math.floor(frame / 2)}`) - 0.5) * 30 * settle * amp(params);
      const slice = random(`s-${Math.floor(frame / 3)}`) * 100;
      node = (
        <div style={base}>
          <span style={{ position: "absolute", inset: 0, color: "#ff2d55", transform: `translateX(${jitter("r")}px)`, mixBlendMode: "screen", opacity: settle }}>{text}</span>
          <span style={{ position: "absolute", inset: 0, color: "#00e5ff", transform: `translateX(${jitter("b")}px)`, mixBlendMode: "screen", opacity: settle }}>{text}</span>
          <span style={{ display: "inline-block", clipPath: settle > 0.05 ? `inset(${slice}% 0 ${Math.max(0, 85 - slice)}% 0)` : undefined, transform: `translateX(${jitter("m") * 0.6}px)` }}>{text}</span>
          {settle > 0.05 && <span style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 ${100 - slice}% 0)` }}>{text}</span>}
        </div>
      );
      break;
    }
    case "wave": {
      const t = frame / fps;
      const loop = bool(params, "loop", true);
      const k = amp(params);
      node = (
        <div style={base}>
          {Array.from(text).map((ch, i) => {
            const local = loop ? t : Math.min(t, num(params, "duration", 1.2));
            const y = Math.sin(local * 6 - i * (num(params, "stagger", 60) / 120)) * 0.25 * k;
            return (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${y}em)`, whiteSpace: "pre" }}>
                {ch}
              </span>
            );
          })}
        </div>
      );
      break;
    }
    case "flicker": {
      const glow = str(params, "glow", "#ff4fd8");
      const t = localProgress(frame, fps, num(params, "delay", 0.1), num(params, "duration", 1.2));
      const on = t >= 1 || (t > 0 && random(`f-${Math.floor(frame / 2)}`) < 0.25 + t * 0.6);
      node = (
        <div style={{ ...base, color: on ? "#fff6fe" : "#3a2a36", textShadow: on ? `0 0 6px ${glow}, 0 0 18px ${glow}, 0 0 42px ${glow}` : "none" }}>{text}</div>
      );
      break;
    }
    case "shadowPop": {
      const sc = str(params, "shadow", "#1f6fd1");
      const depth = Math.round(e * 10 * amp(params));
      const shadow = Array.from({ length: depth }, (_, i) => `${i + 1}px ${i + 1}px 0 ${sc}`).join(",");
      node = <div style={{ ...base, transform: `translate(${-depth / 2}px, ${-depth / 2}px)`, textShadow: shadow || "none", opacity: clamp01(e * 3) }}>{text}</div>;
      break;
    }
    case "marker": {
      const mc = str(params, "marker", "#ffd84d");
      node = (
        <div style={{ ...base, color: "#1d1a16", padding: "0 12px" }}>
          <span style={{ position: "absolute", left: 0, right: 0, top: "18%", bottom: "8%", background: mc, transform: `scaleX(${e}) skewX(-8deg)`, transformOrigin: "left", borderRadius: 6, zIndex: 0 }} />
          <span style={{ position: "relative" }}>{text}</span>
        </div>
      );
      return <AbsoluteFill style={{ ...center, background: content?.bare ? undefined : "#fbfaf7" }}>{node}</AbsoluteFill>;
    }
    case "strike": {
      const lc = str(params, "line", "#e5484d");
      node = (
        <div style={base}>
          {text}
          <span style={{ position: "absolute", left: "-4%", right: "-4%", top: "52%", height: 7, background: lc, transform: `scaleX(${e}) rotate(-3deg)`, transformOrigin: "left", borderRadius: 4 }} />
        </div>
      );
      break;
    }
    case "underline": {
      const lc = str(params, "line", "#1f6fd1");
      const len = 640;
      node = (
        <div style={base}>
          {text}
          <svg viewBox="0 0 400 30" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: -26, width: "100%", height: 26 }}>
            <path d="M5 18 C 80 4, 160 28, 240 12 S 360 6, 395 16" fill="none" stroke={lc} strokeWidth={7} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={(1 - e) * len} />
          </svg>
        </div>
      );
      break;
    }
    case "sweep": {
      const shine = str(params, "tint", "#7cc4ff");
      const pos = lerp(-60, 160, e);
      node = (
        <div
          style={{
            ...base,
            backgroundImage: `linear-gradient(105deg, #f4ede3 ${pos - 30}%, ${shine} ${pos}%, #f4ede3 ${pos + 30}%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {text}
        </div>
      );
      break;
    }
  }
  return <AbsoluteFill style={{ ...center, ...(content?.bare ? {} : darkStage) }}>{node}</AbsoluteFill>;
}

/* ─── Image effects ─────────────────────────────────────────────────────── */

export function ImageFx(props: RenderProps) {
  const { params, config, content } = props;
  const e = progress(props, 1, str(params, "easing", "easeOut"));
  const k = amp(params);
  const img = content?.node ?? <SampleLandscape />;
  switch (String(config.fx)) {
    case "punch":
      return (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <AbsoluteFill style={{ transform: `scale(${1 + (1 - e) * 0.5 * k})`, filter: `blur(${(1 - e) * 10 * k}px)` }}>{img}</AbsoluteFill>
        </AbsoluteFill>
      );
    case "rgb": {
      // Three tinted copies offset horizontally and screened together: a channel split.
      const off = (1 - e) * 18 * k;
      const channel = (tint: string, x: number) => (
        <AbsoluteFill style={{ mixBlendMode: "screen", transform: `translateX(${x}px)` }}>
          {img}
          <AbsoluteFill style={{ background: tint, mixBlendMode: "multiply" }} />
        </AbsoluteFill>
      );
      return (
        <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
          {channel("#ff0000", -off)}
          {channel("#00ff00", 0)}
          {channel("#0000ff", off)}
        </AbsoluteFill>
      );
    }
    case "duotone": {
      const tone = str(params, "tint", "#1f6fd1");
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ filter: `grayscale(${1 - e}) contrast(${1 + (1 - e) * 0.2})` }}>{img}</AbsoluteFill>
          <AbsoluteFill style={{ background: tone, mixBlendMode: "multiply", opacity: (1 - e) * 0.9 }} />
          <AbsoluteFill style={{ background: "#ffe9c9", mixBlendMode: "screen", opacity: (1 - e) * 0.25 }} />
        </AbsoluteFill>
      );
    }
    default:
      return <AbsoluteFill>{img}</AbsoluteFill>;
  }
}

/* ─── Object effects ────────────────────────────────────────────────────── */

export function ObjectFx(props: RenderProps) {
  const { frame, fps, params, config, content, height } = props;
  const k = amp(params);
  const dur = num(params, "duration", 1);
  const t = localProgress(frame, fps, num(params, "delay", 0) + 0.15, dur);
  let transform = "";
  let back = false;
  switch (String(config.fx)) {
    case "pulse": {
      const w = ((frame / fps) / dur) * 2 * Math.PI;
      transform = `scale(${1 + Math.max(0, Math.sin(w)) ** 3 * 0.12 * k})`;
      break;
    }
    case "wiggle":
      transform = `rotate(${Math.sin(t * Math.PI * 8) * (1 - t) * 14 * k}deg)`;
      break;
    case "squash": {
      const y = bounceDrop(t, 55);
      const impact = Math.exp(-((t - 0.28) ** 2) / 0.002) + Math.exp(-((t - 0.57) ** 2) / 0.002) * 0.5;
      transform = `translateY(${(1 - y) * -height * 0.5}px) scale(${1 + impact * 0.25 * k}, ${1 - impact * 0.25 * k})`;
      break;
    }
    case "flip": {
      const e = ease(str(params, "easing", "backOut"), t);
      transform = `perspective(600px) rotateY(${e * 180}deg)`;
      back = e > 0.5;
      break;
    }
  }
  return (
    <AbsoluteFill style={{ ...center, ...darkStage }}>
      <div style={{ transform, transformOrigin: "50% 100%" }}>
        {back ? <SampleObject tint="#6d8bc4" style={{ transform: "scaleX(-1)" }} /> : (content?.node ?? <SampleObject />)}
      </div>
    </AbsoluteFill>
  );
}

/* ─── Backgrounds ───────────────────────────────────────────────────────── */

export function Background2(props: RenderProps) {
  const { frame, fps, params, config, width, height } = props;
  const t = (frame / fps) * (num(params, "speed", 40) / 40);
  const k = amp(params);
  let body: ReactNode = null;
  switch (String(config.kind)) {
    case "aurora": {
      const a = str(params, "a", "#38d6a5");
      const b = str(params, "b", "#6d5bff");
      body = (
        <AbsoluteFill style={{ background: "#070b14", overflow: "hidden" }}>
          {[a, b, a].map((c, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "-20%",
                width: "140%",
                height: 120,
                top: `${18 + i * 18 + Math.sin(t * 0.8 + i) * 6 * k}%`,
                background: `linear-gradient(90deg, transparent, ${c}, transparent)`,
                filter: "blur(38px)",
                opacity: 0.55 + Math.sin(t + i * 2) * 0.2,
                transform: `skewY(${-8 + Math.sin(t * 0.6 + i) * 6}deg) translateX(${Math.sin(t * 0.4 + i) * 8}%)`,
              }}
            />
          ))}
        </AbsoluteFill>
      );
      break;
    }
    case "halftone": {
      const size = 14 + Math.sin(t * 1.5) * 4 * k;
      body = (
        <AbsoluteFill
          style={{
            background: str(params, "base", "#f6f1e7"),
            backgroundImage: `radial-gradient(circle, ${str(params, "tint", "#1f6fd1")} ${size * 0.28}px, transparent ${size * 0.3}px)`,
            backgroundSize: `${size}px ${size}px`,
            backgroundPosition: `${t * 10}px ${t * 6}px`,
            WebkitMaskImage: "radial-gradient(circle at 70% 40%, black 10%, transparent 75%)",
          }}
        />
      );
      break;
    }
    case "scanlines": {
      const roll = ((t * 60) % (height + 80)) - 40;
      body = (
        <AbsoluteFill style={{ background: str(params, "base", "#0f1a12"), overflow: "hidden" }}>
          <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 2px, transparent 2px 4px)" }} />
          <div style={{ position: "absolute", left: 0, width, top: roll, height: 60, background: "linear-gradient(transparent, rgba(160,255,190,.12), transparent)" }} />
          <AbsoluteFill style={{ boxShadow: `inset 0 0 ${120 * k}px rgba(0,0,0,.9)` }} />
        </AbsoluteFill>
      );
      break;
    }
  }
  return (
    <AbsoluteFill>
      {body}
      {!props.content?.node && (
        <AbsoluteFill style={center}>
          <div style={{ ...textStyle, fontSize: 40, color: config.kind === "halftone" ? "#1d1a16" : "#f4ede3" }}>Spring Launch</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/* ─── Video components ──────────────────────────────────────────────────── */

const card: CSSProperties = { background: "#ffffff", color: "#1d1a16", borderRadius: 18, boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)", fontFamily: sans };

function words(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

export function Component(props: RenderProps) {
  const { frame, fps, params, config, width, height } = props;
  const t = frame / fps;
  const delay = num(params, "delay", 0.2);
  const dur = num(params, "duration", 0.7);
  const accent = str(params, "accent", "#1f6fd1");
  const inP = (offset = 0, d = dur, e = "expoOut") => ease(e, localProgress(frame, fps, delay + offset, d));
  const kind = String(config.kind);
  const stage: CSSProperties = { background: "linear-gradient(160deg, #3b3026 0%, #17130f 100%)" };

  switch (kind) {
    case "wordPop":
    case "karaoke": {
      const list = words(str(params, "text", ""));
      const wps = num(params, "wordsPerSecond", 4);
      const active = Math.min(list.length - 1, Math.floor(Math.max(0, t - delay) * wps));
      if (kind === "wordPop") {
        const local = (Math.max(0, t - delay) * wps) % 1;
        const pop = ease("backOut", clamp01(local * 4));
        const upper = bool(params, "uppercase", true);
        const chunk = list.slice(Math.floor(active / 3) * 3, Math.floor(active / 3) * 3 + 3);
        return (
          <AbsoluteFill style={stage}>
            <SampleLandscape />
            <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: height * 0.14 }}>
              <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 46, letterSpacing: "-0.01em", textTransform: upper ? "uppercase" : "none", display: "flex", gap: 14 }}>
                {chunk.map((w, i) => {
                  const idx = Math.floor(active / 3) * 3 + i;
                  const isActive = idx === active;
                  const shown = idx <= active;
                  return (
                    <span key={idx} style={{ color: isActive ? accent : "#fff", opacity: shown ? 1 : 0, transform: `scale(${isActive ? 0.7 + pop * 0.3 : 1})`, display: "inline-block", WebkitTextStroke: "2px #000", paintOrder: "stroke", textShadow: "0 4px 0 rgba(0,0,0,.6)" }}>
                      {w}
                    </span>
                  );
                })}
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        );
      }
      return (
        <AbsoluteFill style={stage}>
          <SampleLandscape />
          <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: height * 0.12 }}>
            <div style={{ maxWidth: width * 0.8, textAlign: "center", fontFamily: sans, fontWeight: 700, fontSize: 30, lineHeight: 1.45, background: "rgba(0,0,0,.55)", padding: "10px 18px", borderRadius: 12 }}>
              {list.map((w, i) => (
                <span key={i} style={{ padding: "1px 6px", borderRadius: 6, background: i === active ? accent : "transparent", color: i <= active ? "#fff" : "rgba(255,255,255,.5)" }}>
                  {w}{" "}
                </span>
              ))}
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "serifKeyword": {
      const list = words(str(params, "text", ""));
      const key = str(params, "keyword", "").toLowerCase();
      return (
        <AbsoluteFill style={{ ...center, background: "#f7f3ec" }}>
          <div style={{ fontFamily: sans, fontSize: 44, fontWeight: 600, color: "#1d1a16", maxWidth: width * 0.84, textAlign: "center", lineHeight: 1.2 }}>
            {list.map((w, i) => {
              const e = inP(i * 0.08, 0.5);
              const isKey = w.toLowerCase().replace(/[^a-z0-9]/g, "") === key;
              return (
                <span key={i} style={{ display: "inline-block", opacity: e, transform: `translateY(${(1 - e) * 16}px)`, marginRight: 12, ...(isKey ? { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 400, color: accent, fontSize: 52 } : {}) }}>
                  {w}
                </span>
              );
            })}
          </div>
        </AbsoluteFill>
      );
    }
    case "twoSpeaker": {
      const lines = [
        { text: str(params, "a"), color: accent, label: "A", at: 0 },
        { text: str(params, "b"), color: str(params, "accent2", "#0f7b6c"), label: "B", at: 1.1 },
      ];
      return (
        <AbsoluteFill style={stage}>
          <SampleLandscape />
          <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, padding: "0 40px 36px" }}>
            {lines.map((l, i) => {
              const e = inP(l.at, 0.5);
              return (
                <div key={i} style={{ alignSelf: i === 0 ? "flex-start" : "flex-end", opacity: e, transform: `translateY(${(1 - e) * 18}px)`, display: "flex", gap: 10, alignItems: "center", background: "rgba(0,0,0,.6)", padding: "8px 14px", borderRadius: 12, fontFamily: sans, fontSize: 22, fontWeight: 600, color: "#fff", maxWidth: "75%" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 13, background: l.color, ...center, fontSize: 14, flexShrink: 0 }}>{l.label}</span>
                  {l.text}
                </div>
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "lowerThird": {
      const style = str(params, "style", "bar");
      const bar = inP(0, dur);
      const textIn = inP(dur * 0.45, dur);
      const name = str(params, "name");
      const role = str(params, "role");
      return (
        <AbsoluteFill style={stage}>
          <SampleLandscape />
          <div style={{ position: "absolute", left: 40, bottom: 44, fontFamily: sans }}>
            {style === "bar" && <div style={{ position: "absolute", left: -14, top: 0, bottom: 0, width: 6, background: accent, transform: `scaleY(${bar})`, transformOrigin: "bottom", borderRadius: 3 }} />}
            <div
              style={{
                ...(style === "boxed" ? { background: "#fff", padding: "10px 16px", borderRadius: 10, boxShadow: "0 18px 40px -16px rgba(0,0,0,.6)" } : {}),
                clipPath: `inset(0 ${(1 - bar) * 100}% 0 0)`,
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: style === "boxed" ? "#1d1a16" : "#fff", transform: `translateY(${(1 - textIn) * 100}%)`, textShadow: style === "boxed" ? "none" : "0 2px 12px rgba(0,0,0,.5)" }}>{name}</div>
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: style === "boxed" ? "#6f6e69" : "rgba(255,255,255,.85)", transform: `translateY(${(1 - inP(dur * 0.6, dur)) * 100}%)` }}>{role}</div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "nameTag": {
      const e = inP(0, dur, "backOut");
      return (
        <AbsoluteFill style={stage}>
          <SampleLandscape />
          <div style={{ position: "absolute", left: 32, top: 32, transform: `scale(${e})`, transformOrigin: "left center", display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "8px 16px 8px 12px", fontFamily: sans, fontWeight: 700, fontSize: 20, color: "#1d1a16" }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: "#e5484d", opacity: Math.floor(t * 2) % 2 ? 1 : 0.35 }} />
            {str(params, "name")}
          </div>
        </AbsoluteFill>
      );
    }
    case "quote": {
      const e = inP(0, dur, "backOut");
      const list = words(str(params, "quote"));
      return (
        <AbsoluteFill style={{ ...center, background: "#efe8dc" }}>
          <div style={{ ...card, width: width * 0.72, padding: "28px 32px", transform: `scale(${0.9 + e * 0.1})`, opacity: clamp01(e * 2) }}>
            <div style={{ fontSize: 54, lineHeight: 0.6, color: accent, fontFamily: "Georgia, serif" }}>“</div>
            <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3, marginTop: 6 }}>
              {list.map((w, i) => (
                <span key={i} style={{ opacity: inP(dur * 0.5 + i * 0.06, 0.3) }}>{w} </span>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 16, color: "#6f6e69", opacity: inP(dur * 0.5 + list.length * 0.06, 0.4) }}>— {str(params, "author")}</div>
          </div>
        </AbsoluteFill>
      );
    }
    case "callout": {
      const draw = inP(0, dur, "easeInOut");
      const label = inP(dur * 0.8, 0.4, "backOut");
      const len = 420;
      return (
        <AbsoluteFill style={darkStage}>
          <AbsoluteFill style={center}>
            <SampleObject style={{ transform: "translate(120px, 40px)" }} />
          </AbsoluteFill>
          <svg width={width} height={height} style={{ position: "absolute" }}>
            <path d={`M150 110 C 230 60, 330 90, ${width / 2 + 60} ${height / 2 - 10}`} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={(1 - draw) * len} />
            <path d={`M${width / 2 + 40} ${height / 2 - 30} L ${width / 2 + 62} ${height / 2 - 8} L ${width / 2 + 34} ${height / 2 + 2}`} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={draw > 0.95 ? 1 : 0} />
          </svg>
          <div style={{ position: "absolute", left: 40, top: 60, transform: `scale(${label})`, transformOrigin: "left", background: accent, color: "#fff", fontFamily: sans, fontWeight: 700, fontSize: 22, padding: "8px 14px", borderRadius: 10 }}>{str(params, "label")}</div>
        </AbsoluteFill>
      );
    }
    case "counter": {
      const e = inP(0, dur, "expoOut");
      const value = num(params, "value", 1000) * e;
      const formatted = Math.round(value).toLocaleString("en-US");
      return (
        <AbsoluteFill style={{ ...center, flexDirection: "column", background: "#fbfaf7", fontFamily: sans }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.03em", color: "#1d1a16", fontVariantNumeric: "tabular-nums" }}>
            {str(params, "prefix")}
            {formatted}
            <span style={{ color: accent }}>{str(params, "suffix")}</span>
          </div>
          <div style={{ fontSize: 24, color: "#6f6e69", opacity: inP(dur * 0.4, 0.5), transform: `translateY(${(1 - inP(dur * 0.4, 0.5)) * 10}px)` }}>{str(params, "label")}</div>
        </AbsoluteFill>
      );
    }
    case "chapter": {
      const rule = inP(0, dur, "easeInOut");
      const title = inP(dur * 0.4, dur);
      return (
        <AbsoluteFill style={{ ...center, background: "#191919", fontFamily: sans }}>
          <div style={{ width: width * 0.7 }}>
            <div style={{ fontSize: 22, color: accent, fontWeight: 700, opacity: inP(0, 0.4) }}>Chapter {str(params, "number")}</div>
            <div style={{ height: 3, background: "#e3e2e0", margin: "12px 0 16px", transform: `scaleX(${rule})`, transformOrigin: "left" }} />
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", transform: `translateY(${(1 - title) * 110}%)` }}>{str(params, "title")}</div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "progress": {
      const e = inP(0, dur, "easeInOut");
      const pct = num(params, "percent", 80) * e;
      return (
        <AbsoluteFill style={{ ...center, background: "#fbfaf7", fontFamily: sans }}>
          <div style={{ width: width * 0.7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 700, color: "#1d1a16", marginBottom: 14 }}>
              <span>{str(params, "label")}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 22, borderRadius: 11, background: "#e9e9e7", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: accent, borderRadius: 11 }} />
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "cta": {
      const pop = inP(0, dur, "backOut");
      const tapT = t - delay - dur - 0.3;
      const tap = bool(params, "cursor", true) && tapT > 0;
      const press = tap ? 1 - Math.exp(-((tapT - 0.15) ** 2) / 0.004) * 0.06 : 1;
      const ripple = tap ? clamp01(tapT / 0.6) : 0;
      const pulse = tapT > 0.8 ? 1 + Math.sin((tapT - 0.8) * 7) * 0.025 : 1;
      return (
        <AbsoluteFill style={{ ...center, ...stage }}>
          <div style={{ position: "relative", transform: `scale(${pop * press * pulse})` }}>
            <div style={{ background: accent, color: "#fff", fontFamily: sans, fontWeight: 800, fontSize: 30, padding: "18px 36px", borderRadius: 999, boxShadow: `0 18px 40px -12px ${accent}` }}>{str(params, "label")}</div>
            {tap && <div style={{ position: "absolute", left: "70%", top: "60%", width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: "50%", border: "3px solid #fff", transform: `scale(${1 + ripple * 3})`, opacity: 1 - ripple }} />}
            {bool(params, "cursor", true) && (
              <svg width={34} height={34} viewBox="0 0 24 24" style={{ position: "absolute", left: "70%", top: "60%", transform: `translate(${(1 - clamp01((t - delay - dur) / 0.4)) * 80}px, ${(1 - clamp01((t - delay - dur) / 0.4)) * 60}px)` }}>
                <path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" strokeWidth={1.4} />
              </svg>
            )}
          </div>
        </AbsoluteFill>
      );
    }
    case "toast": {
      const e = inP(0, dur, "backOut");
      return (
        <AbsoluteFill style={stage}>
          <SampleLandscape />
          <div style={{ position: "absolute", left: "50%", top: 22, width: width * 0.62, transform: `translate(-50%, ${(1 - e) * -140}%)`, background: "rgba(245,245,247,.92)", backdropFilter: "blur(12px)", borderRadius: 20, padding: "14px 16px", display: "flex", gap: 12, fontFamily: sans, boxShadow: "0 20px 40px -18px rgba(0,0,0,.6)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: accent, flexShrink: 0, ...center, color: "#fff", fontWeight: 800, fontSize: 20 }}>{str(params, "app").slice(0, 1)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6f6e69", fontWeight: 600 }}>
                <span>{str(params, "app").toUpperCase()}</span>
                <span>now</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1d1a16" }}>{str(params, "title")}</div>
              <div style={{ fontSize: 15, color: "#37352f" }}>{str(params, "body")}</div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "chat": {
      const msgs = [
        { text: str(params, "a"), me: true, at: 0 },
        { text: str(params, "b"), me: false, at: 0.9 },
        { text: str(params, "c"), me: true, at: 1.9 },
      ];
      return (
        <AbsoluteFill style={{ background: "#ffffff", fontFamily: sans, padding: "28px 60px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
          {msgs.map((m, i) => {
            const typing = t > delay + m.at - 0.6 && t < delay + m.at && !m.me;
            const e = inP(m.at, 0.35, "backOut");
            if (typing)
              return (
                <div key={i} style={{ alignSelf: "flex-start", background: "#e9e9eb", borderRadius: 18, padding: "12px 16px", display: "flex", gap: 5 }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} style={{ width: 8, height: 8, borderRadius: 4, background: "#8e8e93", opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 6 - d)) }} />
                  ))}
                </div>
              );
            if (e <= 0) return null;
            return (
              <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "70%", background: m.me ? accent : "#e9e9eb", color: m.me ? "#fff" : "#1d1a16", fontSize: 20, padding: "10px 16px", borderRadius: 20, transform: `scale(${e})`, transformOrigin: m.me ? "right bottom" : "left bottom" }}>
                {m.text}
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    case "offer": {
      const swing = inP(0, dur * 1.6, "spring");
      const strike = inP(dur, 0.35, "easeOut");
      const now = inP(dur + 0.3, 0.4, "backOut");
      return (
        <AbsoluteFill style={{ ...center, ...stage }}>
          <div style={{ transform: `rotate(${(1 - swing) * -28}deg)`, transformOrigin: "50% -40px" }}>
            <div style={{ ...card, background: accent, color: "#fff", padding: "22px 34px", borderRadius: 14, textAlign: "center", position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: "50%", width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: "#17130f", border: "3px solid #fff" }} />
              <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.08em" }}>{str(params, "note")}</div>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline", justifyContent: "center" }}>
                <span style={{ position: "relative", fontSize: 30, opacity: 0.75 }}>
                  {str(params, "was")}
                  <span style={{ position: "absolute", left: -4, right: -4, top: "50%", height: 4, background: "#fff", transform: `scaleX(${strike})`, transformOrigin: "left" }} />
                </span>
                <span style={{ fontSize: 64, fontWeight: 900, transform: `scale(${now})`, display: "inline-block" }}>{str(params, "now")}</span>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "rating": {
      const rating = num(params, "rating", 4.9);
      return (
        <AbsoluteFill style={{ ...center, flexDirection: "column", gap: 12, background: "#fbfaf7", fontFamily: sans }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => {
              const fill = clamp01(rating - i) * inP(i * 0.12, 0.3, "backOut");
              return (
                <svg key={i} width={54} height={54} viewBox="0 0 24 24" style={{ transform: `scale(${0.6 + inP(i * 0.12, 0.3, "backOut") * 0.4})` }}>
                  <defs>
                    <linearGradient id={`star-${i}`}>
                      <stop offset={`${fill * 100}%`} stopColor="#f5a623" />
                      <stop offset={`${fill * 100}%`} stopColor="#e9e9e7" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2l3 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.6 5.6 21.2l1.6-7.1L1.8 9.3 9 8.6z" fill={`url(#star-${i})`} />
                </svg>
              );
            })}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#1d1a16", opacity: inP(0.6, 0.4) }}>
            {rating.toFixed(1)} <span style={{ fontWeight: 500, color: "#6f6e69", fontSize: 22 }}>{str(params, "label")}</span>
          </div>
        </AbsoluteFill>
      );
    }
    case "logo": {
      const draw = inP(0, dur * 0.6, "easeInOut");
      const fill = inP(dur * 0.55, 0.4, "easeOut");
      const word = inP(dur * 0.7, dur * 0.6, "expoOut");
      const len = 90;
      return (
        <AbsoluteFill style={{ ...center, gap: 22, background: "#111", fontFamily: sans }}>
          <svg viewBox="0 0 24 24" width={110} height={110} fill="none">
            <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={(1 - draw) * len} />
            <circle cx="12" cy="12" r={3.25 * fill} fill={accent} />
          </svg>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 64, letterSpacing: `${(1 - word) * 0.6 + 0.04}em`, opacity: word }}>{str(params, "name")}</div>
        </AbsoluteFill>
      );
    }
    case "endCard": {
      const items = [str(params, "title"), str(params, "cta"), str(params, "handle")];
      return (
        <AbsoluteFill style={{ ...center, flexDirection: "column", gap: 18, background: `radial-gradient(circle at 30% 20%, ${accent}, #0d1626 70%)`, fontFamily: sans, textAlign: "center" }}>
          {items.map((it, i) => {
            const e = inP(i * 0.18, dur);
            const styles: CSSProperties[] = [
              { fontSize: 50, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" },
              { fontSize: 24, fontWeight: 700, color: "#0d1626", background: "#fff", padding: "12px 26px", borderRadius: 999 },
              { fontSize: 20, fontWeight: 500, color: "rgba(255,255,255,.85)" },
            ];
            return (
              <div key={i} style={{ ...styles[i], opacity: e, transform: `translateY(${(1 - e) * 24}px)` }}>
                {it}
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    default:
      return <AbsoluteFill style={stage} />;
  }
}
