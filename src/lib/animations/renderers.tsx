import { useId, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, random } from "remotion";
import { bounceDrop, clamp01, ease, lerp, localProgress } from "./easing";
import { SAMPLE_TEXT, SampleLandscape, SampleObject, Scene, textStyle } from "./samples";
import type { ParamValues } from "./types";
import { Background2, Component, ImageFx, ObjectFx, TextFx } from "./renderers-extra";
import { StopMotion } from "./renderers-stop";

/**
 * Renderers: the `implementation` side of every animation preset.
 * Each is a React component that is a pure function of (frame, params), so the
 * same preset renders identically in previews, the editor and the final render.
 * `content` lets the editor pass real text/media instead of the samples.
 */

export interface RenderProps {
  frame: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  params: ParamValues;
  config: Record<string, unknown>;
  content?: {
    text?: string;
    node?: ReactNode;
    /** Overrides for text presets: font, size, colour, wrapping (used by the CreativeSpec renderer). */
    style?: CSSProperties;
    /** Render without the sample stage background. */
    bare?: boolean;
    /** Real scenes for transitions (default: sample Scene A / Scene B). */
    a?: ReactNode;
    b?: ReactNode;
  };
}

const num = (p: ParamValues, k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
const str = (p: ParamValues, k: string, d = "") => (typeof p[k] === "string" ? (p[k] as string) : d);
const bool = (p: ParamValues, k: string, d = false) => (typeof p[k] === "boolean" ? (p[k] as boolean) : d);
/** Intensity 0–100 → amplitude multiplier 0.3–1.7. */
const amp = (p: ParamValues) => 0.3 + (num(p, "intensity", 50) / 100) * 1.4;
const center: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center" };
const dirVec = (d: string) => ({ up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] })[d] ?? [0, 1];

/* ─── Text ──────────────────────────────────────────────────────────────── */

function splitUnits(text: string, unit: string): { value: string; space: boolean }[] {
  if (unit === "all") return [{ value: text, space: false }];
  if (unit === "line") return text.split("\n").map((value) => ({ value, space: false }));
  if (unit === "word") return text.split(/(\s+)/).filter(Boolean).map((value) => ({ value, space: /^\s+$/.test(value) }));
  return Array.from(text).map((value) => ({ value, space: value === " " }));
}

function Units({ frame, fps, params, config, content }: RenderProps) {
  const unit = String(config.unit ?? "char");
  const text = content?.text ?? (unit === "line" ? SAMPLE_TEXT.line : SAMPLE_TEXT.text);
  const k = amp(params);
  const out = Boolean(config.out);
  const easing = String(config.forceEasing ?? str(params, "easing", "expoOut"));
  const dur = num(params, "duration", 0.8);
  const delay = num(params, "delay", 0.1) + (out ? 1 : 0);
  const stagger = num(params, "stagger", 40) / 1000;
  const [dx, dy] = dirVec(str(params, "direction", "left"));
  let index = 0;

  const units = splitUnits(text, unit);
  const nodes = units.map((u, i) => {
    if (u.space) return <span key={i}>{u.value}</span>;
    const t = localProgress(frame, fps, delay + index++ * stagger, dur);
    const raw = ease(easing, t);
    const e = out ? 1 - raw : raw;
    const inv = 1 - e;
    const transforms: string[] = [];
    if (config.y) transforms.push(`translateY(${Number(config.y) * inv * k}em)`);
    if (config.travel) transforms.push(`translate(${dx * Number(config.travel) * inv * k * 100}%, ${dy * Number(config.travel) * inv * k * 100}%)`);
    if (config.scale) transforms.push(`scale(${lerp(1 + (Number(config.scale) - 1) * k, 1, e)})`);
    const style: CSSProperties = {
      display: "inline-block",
      opacity: config.opacity ? clamp01(e * 1.4) : 1,
      transform: transforms.join(" ") || undefined,
      filter: config.blur ? `blur(${Number(config.blur) * inv * k}px)` : undefined,
      letterSpacing: config.tracking ? `${Number(config.tracking) * inv * k - 0.035}em` : undefined,
      transformOrigin: "50% 60%",
    };
    if (config.mask) {
      return (
        <span key={i} style={{ display: unit === "line" ? "block" : "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em" }}>
          <span style={{ display: "inline-block", transform: `translateY(${inv * 110}%)` }}>{u.value}</span>
          {Boolean(config.rule) && <span style={{ display: "block", height: 3, background: "#e8a33d", transform: `scaleX(${e})`, transformOrigin: "left", marginTop: 6 }} />}
        </span>
      );
    }
    return (
      <span key={i} style={style}>
        {u.value}
      </span>
    );
  });

  return (
    <AbsoluteFill style={center}>
      <div style={{ ...textStyle, ...(unit === "line" ? { textAlign: "left", fontSize: 56 } : {}), ...content?.style }}>{nodes}</div>
    </AbsoluteFill>
  );
}

function Typewriter({ frame, fps, params, content }: RenderProps) {
  const text = content?.text ?? SAMPLE_TEXT.text;
  const t = localProgress(frame, fps, num(params, "delay", 0.1), num(params, "duration", 1.6));
  const shown = Math.floor(ease(str(params, "easing", "linear"), t) * text.length);
  const caretOn = bool(params, "caret", true) && Math.floor(frame / 15) % 2 === 0;
  return (
    <AbsoluteFill style={center}>
      <div style={{ ...textStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight: 500, fontSize: 56, ...content?.style }}>
        {text.slice(0, shown)}
        <span style={{ opacity: caretOn ? 1 : 0, color: "#e8a33d" }}>▍</span>
      </div>
    </AbsoluteFill>
  );
}

const GLYPHS: Record<string, string> = { symbols: "#%&*+=?/<>[]{}$@!", binary: "01", letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" };

function Scramble({ frame, fps, params, content }: RenderProps) {
  const text = content?.text ?? SAMPLE_TEXT.text;
  const pool = GLYPHS[str(params, "glyphs", "symbols")] ?? GLYPHS.symbols!;
  const delay = num(params, "delay", 0.1);
  const stagger = num(params, "stagger", 30) / 1000;
  const dur = num(params, "duration", 1.2);
  return (
    <AbsoluteFill style={center}>
      <div style={{ ...textStyle, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontWeight: 600, fontSize: 60, ...content?.style }}>
        {Array.from(text).map((ch, i) => {
          const t = localProgress(frame, fps, delay + i * stagger, dur * 0.5);
          if (ch === " ") return <span key={i}> </span>;
          if (t >= 1) return <span key={i}>{ch}</span>;
          const g = pool[Math.floor(random(`${i}-${Math.floor(frame / 2)}`) * pool.length)];
          return (
            <span key={i} style={{ opacity: t > 0 ? 0.9 : 0.25, color: "#e8a33d" }}>
              {g}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Split({ frame, fps, params, content }: RenderProps) {
  const text = content?.text ?? SAMPLE_TEXT.text;
  const t = localProgress(frame, fps, num(params, "delay", 0.1), num(params, "duration", 0.9));
  const e = ease(str(params, "easing", "expoOut"), t);
  const shift = (1 - e) * 60 * amp(params);
  const half = (top: boolean): CSSProperties => ({
    ...textStyle,
    ...content?.style,
    position: "absolute",
    clipPath: top ? "inset(0 0 50% 0)" : "inset(50% 0 0 0)",
    transform: `translateX(${top ? -shift : shift}%)`,
    opacity: clamp01(e * 1.5),
  });
  return (
    <AbsoluteFill style={center}>
      <div style={half(true)}>{text}</div>
      <div style={half(false)}>{text}</div>
    </AbsoluteFill>
  );
}

/* ─── Image ─────────────────────────────────────────────────────────────── */

function imageProgress({ frame, fps, params }: RenderProps) {
  return ease(str(params, "easing", "easeInOut"), localProgress(frame, fps, num(params, "delay", 0), num(params, "duration", 3)));
}

function ImageTransform(props: RenderProps) {
  const { params, config, content } = props;
  const e = imageProgress(props);
  const k = amp(props.params);
  const [dx, dy] = dirVec(str(params, "direction", "right"));
  const scale = 1 + Number(config.zoom ?? 0.2) * k * e + Number(config.drift ?? 0) * 0.6;
  const drift = Number(config.drift ?? 0) * k * e * 100;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translate(${-dx * drift}%, ${-dy * drift * 0.4}%)` }}>{content?.node ?? <SampleLandscape />}</AbsoluteFill>
    </AbsoluteFill>
  );
}

function ImageParallax(props: RenderProps) {
  const e = imageProgress(props);
  const k = amp(props.params);
  const [dx] = dirVec(str(props.params, "direction", "left"));
  const layer = (f: number): CSSProperties => ({ transform: `translateX(${dx * (e - 0.5) * f * 70 * k}px)` });
  return <SampleLandscape layers={[{}, layer(0.1), layer(0.3), layer(0.6), layer(1.2)]} />;
}

function ImageReveal(props: RenderProps) {
  const e = imageProgress(props);
  const d = str(props.params, "direction", "up");
  const r = (1 - e) * 100;
  const inset = { up: `${r}% 0 0 0`, down: `0 0 ${r}% 0`, left: `0 0 0 ${r}%`, right: `0 ${r}% 0 0` }[d];
  return (
    <AbsoluteFill style={{ clipPath: `inset(${inset})` }}>
      <AbsoluteFill style={{ transform: `scale(${1.15 - 0.15 * e})` }}>{props.content?.node ?? <SampleLandscape />}</AbsoluteFill>
    </AbsoluteFill>
  );
}

function ImageDepth(props: RenderProps) {
  const e = imageProgress(props);
  const k = amp(props.params);
  const back: CSSProperties = { filter: `blur(${e * 5 * k}px)`, transform: `scale(${1 + 0.04 * e})` };
  return <SampleLandscape layers={[back, back, back, { filter: `blur(${e * 2 * k}px)` }, { transform: `scale(${1 + 0.1 * e * k}) translateY(${-e * 6}px)` }]} />;
}

function ImageBlur(props: RenderProps) {
  const e = imageProgress(props);
  return (
    <AbsoluteFill style={{ filter: `blur(${(1 - e) * 26 * amp(props.params)}px)`, transform: `scale(${1.1 - 0.1 * e})`, opacity: clamp01(0.2 + e) }}>
      {props.content?.node ?? <SampleLandscape />}
    </AbsoluteFill>
  );
}

/* ─── Object ────────────────────────────────────────────────────────────── */

const stage: CSSProperties = { ...center, background: "radial-gradient(circle at 50% 40%, #2b2621, #12100e)" };

function ObjectLoop({ frame, fps, params, config, content }: RenderProps) {
  const t = frame / fps;
  const dur = num(params, "duration", 3);
  const k = amp(params);
  const w = (2 * Math.PI * t) / dur;
  const transform =
    config.mode === "drift"
      ? `translate(${Math.sin(w * 0.77) * 34 * k}px, ${Math.cos(w) * 16 * k}px) rotate(${Math.sin(w * 0.5) * 5 * k}deg)`
      : `translateY(${Math.sin(w) * 16 * k}px)`;
  return (
    <AbsoluteFill style={stage}>
      <div style={{ transform }}>{content?.node ?? <SampleObject />}</div>
      <div style={{ position: "absolute", bottom: 70, width: 110, height: 14, borderRadius: "50%", background: "rgba(0,0,0,.45)", filter: "blur(6px)", transform: `scale(${1 - Math.sin(w) * 0.12 * k})` }} />
    </AbsoluteFill>
  );
}

function ObjectSpring({ frame, fps, params, config, content, height }: RenderProps) {
  const t = localProgress(frame, fps, num(params, "delay", 0) + 0.15, num(params, "duration", 1.2));
  const b = num(params, "bounciness", 60);
  const transform =
    config.mode === "drop"
      ? `translateY(${(1 - bounceDrop(t, b)) * -height * 0.55 * amp(params)}px)`
      : `scale(${Math.max(0, ease("spring", t, b))})`;
  return (
    <AbsoluteFill style={stage}>
      <div style={{ transform }}>{content?.node ?? <SampleObject />}</div>
    </AbsoluteFill>
  );
}

function ObjectRotate({ frame, fps, params, content }: RenderProps) {
  const t = localProgress(frame, fps, num(params, "delay", 0) + 0.15, num(params, "duration", 2));
  const e = ease(str(params, "easing", "easeInOut"), t);
  return (
    <AbsoluteFill style={stage}>
      <div style={{ transform: `rotate(${e * num(params, "turns", 1) * 360}deg)` }}>{content?.node ?? <SampleObject />}</div>
    </AbsoluteFill>
  );
}

function ObjectScale({ frame, fps, params, content }: RenderProps) {
  const dur = num(params, "duration", 0.8);
  const delay = num(params, "delay", 0) + 0.15;
  const e = ease(str(params, "easing", "backOut"), localProgress(frame, fps, delay, dur));
  const after = frame / fps - delay - dur;
  const pulse = bool(params, "pulse") && after > 0 ? 1 + Math.sin(after * 6) * 0.05 * amp(params) : 1;
  return (
    <AbsoluteFill style={stage}>
      <div style={{ transform: `scale(${Math.max(0, e) * pulse})` }}>{content?.node ?? <SampleObject />}</div>
    </AbsoluteFill>
  );
}

function ObjectMagnetic({ frame, fps, params, width, height, content }: RenderProps) {
  const dur = num(params, "duration", 3);
  const target = (time: number) => ({ x: Math.sin((time / dur) * 2 * Math.PI) * width * 0.32, y: Math.sin((time / dur) * 4 * Math.PI) * height * 0.22 });
  const t = frame / fps;
  const cursor = target(t);
  const lag = target(t - 0.18);
  const pull = 0.35 * amp(params);
  return (
    <AbsoluteFill style={stage}>
      <div style={{ transform: `translate(${lag.x * pull}px, ${lag.y * pull}px) rotate(${lag.x * 0.02}deg)` }}>{content?.node ?? <SampleObject />}</div>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: "50%", border: "2px solid #f4ede3", transform: `translate(${cursor.x}px, ${cursor.y}px)` }} />
    </AbsoluteFill>
  );
}

function ObjectPath({ frame, fps, params, width, height, content }: RenderProps) {
  const e = ease(str(params, "easing", "easeInOut"), localProgress(frame, fps, num(params, "delay", 0) + 0.1, num(params, "duration", 2.5)));
  const P = [
    [width * 0.12, height * 0.75],
    [width * 0.35, height * 0.05],
    [width * 0.6, height * 1.0],
    [width * 0.88, height * 0.3],
  ] as const;
  const at = (t: number) => {
    const u = 1 - t;
    return [0, 1].map((i) => u ** 3 * P[0][i]! + 3 * u * u * t * P[1][i]! + 3 * u * t * t * P[2][i]! + t ** 3 * P[3][i]!);
  };
  const [x, y] = at(e);
  const [x2, y2] = at(Math.min(1, e + 0.01));
  const angle = (Math.atan2(y2! - y!, x2! - x!) * 180) / Math.PI;
  return (
    <AbsoluteFill style={{ background: stage.background }}>
      {bool(params, "showPath", true) && (
        <svg width={width} height={height} style={{ position: "absolute" }}>
          <path d={`M${P[0].join(" ")} C${P[1].join(" ")} ${P[2].join(" ")} ${P[3].join(" ")}`} stroke="#f4ede355" strokeWidth={2} strokeDasharray="6 8" fill="none" />
        </svg>
      )}
      <div style={{ position: "absolute", left: x! - 40, top: y! - 40, transform: `rotate(${angle}deg) scale(.66)`, transformOrigin: "40px 40px" }}>
        {content?.node ?? <SampleObject />}
      </div>
    </AbsoluteFill>
  );
}

/* ─── Transitions ───────────────────────────────────────────────────────── */

function Transition(props: RenderProps) {
  const { frame, fps, params, config, width, height, durationInFrames } = props;
  const id = useId().replace(/:/g, "");
  const dur = num(params, "duration", 0.9);
  const start = (durationInFrames / fps - dur) / 2;
  const t = localProgress(frame, fps, start, dur);
  const e = ease(str(params, "easing", "easeInOut"), t);
  const k = amp(params);
  const kind = String(config.kind);
  const A = (style?: CSSProperties) => (props.content?.a ? <AbsoluteFill style={style}>{props.content.a}</AbsoluteFill> : <Scene variant="a" style={style} />);
  const B = (style?: CSSProperties) => (props.content?.b ? <AbsoluteFill style={style}>{props.content.b}</AbsoluteFill> : <Scene variant="b" style={style} />);

  switch (kind) {
    case "shape": {
      const shape = str(params, "shape", "circle");
      const r = e * 100;
      const clip =
        shape === "circle" ? `circle(${e * 75}% at 50% 50%)` : shape === "diamond" ? `polygon(50% ${50 - r}%, ${50 + r}% 50%, 50% ${50 + r}%, ${50 - r}% 50%)` : `inset(${50 - r / 2}% ${50 - r / 2}% ${50 - r / 2}% ${50 - r / 2}%)`;
      return (
        <AbsoluteFill>
          {A()}
          {B({ clipPath: clip })}
        </AbsoluteFill>
      );
    }
    case "mask": {
      const soft = 5 + num(params, "intensity", 40) * 0.4;
      const pos = e * (100 + soft) - soft;
      const to = { right: "to right", left: "to left", up: "to top", down: "to bottom" }[str(params, "direction", "right")];
      const mask = `linear-gradient(${to}, black ${pos}%, transparent ${pos + soft}%)`;
      return (
        <AbsoluteFill>
          {A()}
          {B({ WebkitMaskImage: mask, maskImage: mask })}
        </AbsoluteFill>
      );
    }
    case "blur":
      return (
        <AbsoluteFill>
          {A({ filter: `blur(${e * 22 * k}px)`, opacity: 1 - e })}
          {B({ filter: `blur(${(1 - e) * 22 * k}px)`, opacity: e })}
        </AbsoluteFill>
      );
    case "push":
      return (
        <AbsoluteFill style={{ background: "#000" }}>
          {A({ transform: `scale(${1 + e * 0.9 * k})`, opacity: 1 - e, filter: `blur(${e * 6}px)` })}
          {B({ transform: `scale(${0.82 + 0.18 * e})`, opacity: e })}
        </AbsoluteFill>
      );
    case "pull":
      return (
        <AbsoluteFill style={{ background: "#000" }}>
          {B({ transform: `scale(${1.35 - 0.35 * e})`, opacity: e })}
          {A({ transform: `scale(${1 - e * 0.45 * k})`, opacity: 1 - e, borderRadius: e * 24 })}
        </AbsoluteFill>
      );
    case "liquid": {
      const distort = Math.sin(Math.PI * e) * 90 * k;
      return (
        <AbsoluteFill>
          <svg width={0} height={0} style={{ position: "absolute" }}>
            <filter id={`liq${id}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={3} />
              <feDisplacementMap in="SourceGraphic" scale={distort} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <AbsoluteFill style={{ filter: `url(#liq${id})` }}>
            {A({ opacity: 1 - e })}
            {B({ opacity: e })}
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "morph": {
      const first = e < 0.5;
      const s = first ? 1 - e : e;
      return (
        <AbsoluteFill style={{ ...center, background: "#0d0b09" }}>
          <div style={{ position: "relative", width, height, transform: `scale(${s})`, borderRadius: `${(1 - Math.abs(e - 0.5) * 2) * 50}%`, overflow: "hidden" }}>{first ? A() : B()}</div>
        </AbsoluteFill>
      );
    }
    case "pixel": {
      const size = num(params, "size", 12) * 3;
      const cols = Math.ceil(width / size);
      const rows = Math.ceil(height / size);
      const rects: ReactNode[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (random(`px-${r}-${c}`) < e) rects.push(<rect key={`${r}-${c}`} x={c / cols} y={r / rows} width={1 / cols + 0.002} height={1 / rows + 0.002} />);
      return (
        <AbsoluteFill>
          <svg width={0} height={0} style={{ position: "absolute" }}>
            <clipPath id={`px${id}`} clipPathUnits="objectBoundingBox">
              {rects}
            </clipPath>
          </svg>
          {A()}
          {B({ clipPath: `url(#px${id})` })}
        </AbsoluteFill>
      );
    }
    case "grain":
      return (
        <AbsoluteFill>
          {A({ opacity: 1 - e })}
          {B({ opacity: e })}
          <Noise seed={frame} frequency={0.85} opacity={Math.sin(Math.PI * e) * 0.9 * k} id={`gr${id}`} />
        </AbsoluteFill>
      );
    case "film": {
      const jitter = (random(`j${frame}`) - 0.5) * 14 * k * Math.sin(Math.PI * e);
      const flash = Math.max(0, 1 - Math.abs(e - 0.5) * 8);
      return (
        <AbsoluteFill style={{ transform: `translateY(${jitter}px)`, filter: `sepia(${Math.sin(Math.PI * e) * 0.6}) contrast(${1 + Math.sin(Math.PI * e) * 0.3})` }}>
          {e < 0.5 ? A() : B()}
          <AbsoluteFill style={{ background: "#fff8ec", opacity: flash }} />
          <Noise seed={frame} frequency={0.9} opacity={0.35 * Math.sin(Math.PI * e)} id={`fm${id}`} />
        </AbsoluteFill>
      );
    }
    case "whip": {
      const [dx] = dirVec(str(params, "direction", "left"));
      const blur = Math.sin(Math.PI * e) * 26 * k;
      return (
        <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
          {A({ transform: `translateX(${dx * e * 100}%)`, filter: `blur(${blur}px)` })}
          {B({ transform: `translateX(${-dx * (1 - e) * 100}%)`, filter: `blur(${blur}px)` })}
        </AbsoluteFill>
      );
    }
    case "zoomThrough":
      return (
        <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
          {e < 0.5 ? A({ transform: `scale(${1 + e * 6 * k})`, opacity: 1 - e * 2, filter: `blur(${e * 16}px)` }) : B({ transform: `scale(${0.3 + (e - 0.5) * 1.4})`, opacity: (e - 0.5) * 2 })}
        </AbsoluteFill>
      );
    case "iris": {
      const r = e < 0.5 ? (1 - e * 2) * 75 : (e - 0.5) * 2 * 75;
      return <AbsoluteFill style={{ background: "#000" }}>{(e < 0.5 ? A : B)({ clipPath: `circle(${r}% at 50% 50%)` })}</AbsoluteFill>;
    }
    case "doors":
      return (
        <AbsoluteFill>
          {B({ transform: `scale(${1.1 - 0.1 * e})` })}
          {A({ clipPath: "inset(0 50% 0 0)", transform: `translateX(${-e * 52}%)` })}
          {A({ clipPath: "inset(0 0 0 50%)", transform: `translateX(${e * 52}%)` })}
        </AbsoluteFill>
      );
    case "stripes": {
      const n = Math.round(num(params, "count", 6));
      return (
        <AbsoluteFill>
          {A()}
          {Array.from({ length: n }, (_, i) => {
            const local = clamp01((t - i * (0.35 / n)) / 0.65);
            const p = ease(str(params, "easing", "expoOut"), local);
            return <AbsoluteFill key={i}>{B({ clipPath: `inset(${(i / n) * 100}% ${(1 - p) * 100}% ${100 - ((i + 1) / n) * 100}% 0)` })}</AbsoluteFill>;
          })}
        </AbsoluteFill>
      );
    }
    case "leak": {
      const c = str(params, "color", "#ff8a3d");
      const sweep = lerp(-40, 140, e);
      return (
        <AbsoluteFill>
          {A({ opacity: 1 - clamp01((e - 0.3) / 0.4) })}
          {B({ opacity: clamp01((e - 0.3) / 0.4) })}
          <AbsoluteFill
            style={{
              mixBlendMode: "screen",
              opacity: Math.sin(Math.PI * e),
              background: `radial-gradient(ellipse 60% 90% at ${sweep}% 40%, ${c} 0%, transparent 60%), radial-gradient(circle at ${sweep - 30}% 80%, #ffd27a 0%, transparent 45%)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    default:
      return A();
  }
}

function Noise({ seed, frequency, opacity, id }: { seed: number; frequency: number; opacity: number; id: string }) {
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
}

/* ─── Backgrounds ───────────────────────────────────────────────────────── */

function Background(props: RenderProps) {
  const { frame, fps, params, config, width, height } = props;
  const id = useId().replace(/:/g, "");
  const t = frame / fps;
  const spd = num(params, "speed", 40) / 40;
  const k = amp(params);
  const kind = String(config.kind);

  let body: ReactNode;
  switch (kind) {
    case "grain":
      body = (
        <AbsoluteFill style={{ background: str(params, "base", "#1b1916") }}>
          <Noise seed={Math.floor(frame * spd)} frequency={0.9} opacity={0.35 * k} id={`bg${id}`} />
        </AbsoluteFill>
      );
      break;
    case "noise":
      body = (
        <AbsoluteFill style={{ background: str(params, "base", "#20314a"), overflow: "hidden" }}>
          <svg width={width * 2} height={height * 2} style={{ position: "absolute", transform: `translate(${-((t * spd * 30) % width)}px, ${-((t * spd * 12) % height)}px)`, opacity: 0.55 * k, mixBlendMode: "screen" }}>
            <filter id={`nz${id}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves={3} seed={7} stitchTiles="stitch" />
              <feColorMatrix type="matrix" values={`0 0 0 0 ${hexRgb(str(params, "tint", "#e8a33d"))[0]} 0 0 0 0 ${hexRgb(str(params, "tint", "#e8a33d"))[1]} 0 0 0 0 ${hexRgb(str(params, "tint", "#e8a33d"))[2]} 0 0 0 1.2 -0.2`} />
            </filter>
            <rect width="100%" height="100%" filter={`url(#nz${id})`} />
          </svg>
        </AbsoluteFill>
      );
      break;
    case "gradient": {
      const angle = 120 + Math.sin(t * spd * 0.6) * 40 * k;
      body = <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${str(params, "from", "#2a1b4f")}, ${str(params, "to", "#e8a33d")} ${50 + Math.sin(t * spd) * 30}%, ${str(params, "from", "#2a1b4f")})` }} />;
      break;
    }
    case "particles": {
      const count = num(params, "count", 60);
      const tint = str(params, "tint", "#f4ede3");
      body = (
        <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 120%, #2b2340, #0c0b10)" }}>
          {Array.from({ length: count }, (_, i) => {
            const depth = 0.3 + random(`d${i}`) * 0.7;
            const x = random(`x${i}`) * width + Math.sin(t * spd + i) * 10;
            const y = ((random(`y${i}`) * height - t * spd * 30 * depth) % height + height) % height;
            const s = 1.5 + depth * 3 * k;
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%", background: tint, opacity: 0.25 + depth * 0.6, boxShadow: `0 0 ${s * 2}px ${tint}` }} />;
          })}
        </AbsoluteFill>
      );
      break;
    }
    case "grid": {
      const tint = str(params, "tint", "#e8a33d");
      const cell = 48;
      body = (
        <AbsoluteFill style={{ background: "linear-gradient(#120d1c 0%, #2b1433 55%, #120d1c 100%)", perspective: 420, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: "-50%",
              width: "200%",
              top: "48%",
              height: "120%",
              transform: "rotateX(68deg)",
              transformOrigin: "top",
              backgroundImage: `linear-gradient(${tint} 1.5px, transparent 1.5px), linear-gradient(90deg, ${tint} 1.5px, transparent 1.5px)`,
              backgroundSize: `${cell}px ${cell}px`,
              backgroundPosition: `0 ${(t * spd * 60) % cell}px`,
              opacity: 0.35 + 0.4 * (k / 1.7),
              WebkitMaskImage: "linear-gradient(transparent, black 40%)",
            }}
          />
          <div style={{ position: "absolute", left: "50%", top: "30%", width: 160, height: 160, marginLeft: -80, borderRadius: "50%", background: `linear-gradient(${tint}, #ff5f8f)`, opacity: 0.85 }} />
        </AbsoluteFill>
      );
      break;
    }
    case "wave": {
      const tint = str(params, "tint", "#6db3c9");
      body = (
        <AbsoluteFill style={{ background: "#0b1a22" }}>
          <svg width={width} height={height}>
            {[0, 1, 2, 3].map((i) => {
              const pts: string[] = [];
              for (let x = 0; x <= width; x += 8) {
                const y = height * (0.45 + i * 0.09) + Math.sin(x * 0.012 + t * spd * 2 + i * 1.3) * 22 * k + Math.sin(x * 0.03 - t * spd) * 6;
                pts.push(`${x},${y.toFixed(1)}`);
              }
              return <polyline key={i} points={pts.join(" ")} fill="none" stroke={tint} strokeOpacity={0.9 - i * 0.18} strokeWidth={2.5 - i * 0.4} />;
            })}
          </svg>
        </AbsoluteFill>
      );
      break;
    }
    case "liquid": {
      const tint = str(params, "tint", "#ff6b6b");
      body = (
        <AbsoluteFill style={{ background: "#14101a" }}>
          <svg width={width} height={height}>
            <filter id={`goo${id}`}>
              <feGaussianBlur stdDeviation={14} />
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9" />
            </filter>
            <g filter={`url(#goo${id})`} fill={tint}>
              {Array.from({ length: 6 }, (_, i) => (
                <circle key={i} cx={width / 2 + Math.sin(t * spd * (0.6 + i * 0.13) + i * 2) * width * 0.25 * k} cy={height / 2 + Math.cos(t * spd * (0.5 + i * 0.11) + i) * height * 0.22 * k} r={36 + (i % 3) * 14} />
              ))}
            </g>
          </svg>
        </AbsoluteFill>
      );
      break;
    }
    case "glow": {
      const tint = str(params, "tint", "#e8a33d");
      const breathe = (i: number) => 0.45 + 0.35 * Math.sin(t * spd * 1.4 + i * 2);
      body = (
        <AbsoluteFill style={{ background: "#0e0c0a" }}>
          {[[30, 40], [70, 60], [50, 85]].map(([x, y], i) => (
            <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 300 * k, height: 300 * k, marginLeft: -150 * k, marginTop: -150 * k, borderRadius: "50%", background: tint, filter: "blur(70px)", opacity: breathe(i) }} />
          ))}
        </AbsoluteFill>
      );
      break;
    }
    case "mesh": {
      const cols = [str(params, "a", "#e8a33d"), str(params, "b", "#6d8bc4"), str(params, "c", "#b07bac")];
      const grads = cols.map((c, i) => {
        const a = t * spd * 0.5 + (i * 2 * Math.PI) / 3;
        return `radial-gradient(circle at ${50 + Math.cos(a) * 28 * k}% ${50 + Math.sin(a) * 28 * k}%, ${c} 0%, transparent 55%)`;
      });
      body = <AbsoluteFill style={{ background: `${grads.join(",")}, #15131a`, filter: "saturate(1.1)" }} />;
      break;
    }
    default:
      body = null;
  }

  return (
    <AbsoluteFill>
      {body}
      {!props.content?.node && (
        <AbsoluteFill style={center}>
          <div style={{ ...textStyle, fontSize: 40, opacity: 0.92, textShadow: "0 2px 24px rgba(0,0,0,.4)" }}>Spring Launch</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ─── 3D / Advanced ─────────────────────────────────────────────────────── */

function Three(props: RenderProps) {
  const { frame, fps, params, config, width, height } = props;
  const t = frame / fps;
  const dur = num(params, "duration", 3);
  const k = amp(params);
  const tint = str(params, "tint", "#e8a33d");
  const kind = String(config.kind);
  const scene: CSSProperties = { ...center, perspective: 900, background: "radial-gradient(circle at 50% 40%, #2a241f, #0d0b09)", overflow: "hidden" };
  const card = (i: number, extra: CSSProperties): CSSProperties => ({
    position: "absolute",
    width: 150,
    height: 200,
    borderRadius: 14,
    background: `linear-gradient(160deg, hsl(${30 + i * 40} 55% 62%), hsl(${10 + i * 40} 45% 30%))`,
    boxShadow: "0 30px 60px -25px rgba(0,0,0,.8)",
    ...extra,
  });

  switch (kind) {
    case "orbit": {
      const rot = Math.sin((t / dur) * 2 * Math.PI) * 50 * k;
      return (
        <AbsoluteFill style={scene}>
          <div style={{ transformStyle: "preserve-3d", transform: `rotateX(-8deg) rotateY(${rot}deg)` }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={card(i, { left: -75, top: -100, transform: `rotateY(${(i - 2) * 32}deg) translateZ(260px)` })} />
            ))}
          </div>
        </AbsoluteFill>
      );
    }
    case "spin": {
      const ry = ease(str(params, "easing", "linear"), (t % dur) / dur) * 360;
      const s = 140;
      const faces: [string, string][] = [
        [`translateZ(${s / 2}px)`, tint],
        [`rotateY(180deg) translateZ(${s / 2}px)`, tint],
        [`rotateY(90deg) translateZ(${s / 2}px)`, "#9a6a2c"],
        [`rotateY(-90deg) translateZ(${s / 2}px)`, "#9a6a2c"],
        [`rotateX(90deg) translateZ(${s / 2}px)`, "#ffd79a"],
        [`rotateX(-90deg) translateZ(${s / 2}px)`, "#5b3d18"],
      ];
      return (
        <AbsoluteFill style={scene}>
          <div style={{ width: s, height: s, position: "relative", transformStyle: "preserve-3d", transform: `rotateX(-18deg) rotateY(${ry}deg)` }}>
            {faces.map(([tr, c], i) => (
              <div key={i} style={{ position: "absolute", inset: 0, background: c, transform: tr, border: "1px solid rgba(0,0,0,.15)", ...center, color: "#1d1308", fontWeight: 700, fontSize: 22 }}>
                {i === 0 ? "CR" : ""}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 70, width: 180, height: 18, borderRadius: "50%", background: "rgba(0,0,0,.5)", filter: "blur(8px)" }} />
        </AbsoluteFill>
      );
    }
    case "tunnel":
      return (
        <AbsoluteFill style={{ ...scene, background: "#07060a" }}>
          {Array.from({ length: 14 }, (_, i) => {
            const z = (((i / 14 + (t / dur) * 0.6 * k) % 1) + 1) % 1;
            const scale = 0.05 + z ** 2.2 * 2.2;
            return <div key={i} style={{ position: "absolute", width: width * 0.5, height: height * 0.5, border: `2px solid ${tint}`, borderRadius: 10, transform: `scale(${scale}) rotate(${z * 30}deg)`, opacity: Math.min(1, z * 2) * (1 - z) * 2 }} />;
          })}
        </AbsoluteFill>
      );
    case "particles":
      return (
        <AbsoluteFill style={{ background: "#05050a", overflow: "hidden" }}>
          {Array.from({ length: 140 }, (_, i) => {
            const x = (random(`px${i}`) - 0.5) * width * 2;
            const y = (random(`py${i}`) - 0.5) * height * 2;
            const z = ((((random(`pz${i}`) - (t / dur) * 0.5 * k) % 1) + 1) % 1) + 0.05;
            const sx = width / 2 + x * (0.35 / z);
            const sy = height / 2 + y * (0.35 / z);
            const s = Math.min(6, 1.2 / z);
            return <div key={i} style={{ position: "absolute", left: sx, top: sy, width: s, height: s, borderRadius: "50%", background: "#f4ede3", opacity: Math.min(1, (1.05 - z) * 1.4) }} />;
          })}
        </AbsoluteFill>
      );
    case "planes": {
      const w = (t / dur) * 2 * Math.PI;
      return (
        <AbsoluteFill style={scene}>
          <div style={{ transformStyle: "preserve-3d", transform: `rotateY(${Math.sin(w) * 28}deg) rotateX(${12 + Math.cos(w) * 8}deg)` }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={card(i, { left: -120 + i * 10, top: -90 + i * 8, width: 240, height: 170, transform: `translateZ(${(i - 1.5) * 70 * k}px)`, opacity: 0.92 })} />
            ))}
          </div>
        </AbsoluteFill>
      );
    }
    case "reveal": {
      const e = ease(str(params, "easing", "expoOut"), localProgress(frame, fps, num(params, "delay", 0) + 0.15, num(params, "duration", 1.4)));
      const sweep = lerp(-60, 160, clamp01((frame / fps - num(params, "duration", 1.4) * 0.6) / 1.2));
      return (
        <AbsoluteFill style={scene}>
          <div style={{ transform: `translateZ(${(1 - e) * -500}px) rotateX(${(1 - e) * 80}deg)`, opacity: clamp01(e * 2), position: "relative" }}>
            <SampleObject tint={tint} style={{ width: 170, height: 170, borderRadius: 36 }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 36, background: `linear-gradient(105deg, transparent ${sweep - 20}%, rgba(255,255,255,.55) ${sweep}%, transparent ${sweep + 20}%)`, mixBlendMode: "overlay" }} />
          </div>
        </AbsoluteFill>
      );
    }
    default:
      return <AbsoluteFill style={scene} />;
  }
}

export const RENDERERS: Record<string, (props: RenderProps) => ReactNode> = {
  units: Units,
  typewriter: Typewriter,
  scramble: Scramble,
  split: Split,
  imageTransform: ImageTransform,
  imageParallax: ImageParallax,
  imageReveal: ImageReveal,
  imageDepth: ImageDepth,
  imageBlur: ImageBlur,
  objectLoop: ObjectLoop,
  objectSpring: ObjectSpring,
  objectRotate: ObjectRotate,
  objectScale: ObjectScale,
  objectMagnetic: ObjectMagnetic,
  objectPath: ObjectPath,
  transition: Transition,
  background: Background,
  three: Three,
  textFx: TextFx,
  imageFx: ImageFx,
  objectFx: ObjectFx,
  background2: Background2,
  component: Component,
  stopMotion: StopMotion,
};
