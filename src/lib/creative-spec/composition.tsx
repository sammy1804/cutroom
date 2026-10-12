import type { CSSProperties } from "react";
import { AbsoluteFill, Freeze, Img, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { getPreset } from "@/lib/animations/presets";
import { RENDERERS } from "@/lib/animations/renderers";
import { sanitizeParams } from "@/lib/animations/types";
import { FONT_STACK, sceneOffsets, type AnimationRef, type CreativeSpecDoc, type SpecElement, type SpecScene } from "./schema";

/**
 * Renders a CreativeSpec with Remotion. The editor preview and the final
 * render both use this component, so what people approve is what gets rendered.
 */

export interface SpecCompositionProps extends Record<string, unknown> {
  spec: CreativeSpecDoc;
  /** Element to outline in the editor preview. */
  highlight?: string | null;
}

const REGION: Record<SpecElement["layout"], CSSProperties> = {
  center: { left: "7%", right: "7%", top: "12%", bottom: "12%" },
  top: { left: "7%", right: "7%", top: "7%", height: "34%" },
  bottom: { left: "7%", right: "7%", bottom: "9%", height: "30%" },
  "lower-left": { left: "7%", width: "72%", bottom: "8%", height: "30%" },
  fullbleed: { left: 0, right: 0, top: 0, bottom: 0 },
};

function presetFor(ref: AnimationRef | null, category: string) {
  const preset = ref ? getPreset(ref.presetId) : undefined;
  return preset && preset.category === category ? { preset, params: sanitizeParams(preset, ref?.params ?? {}) } : null;
}

/** Runs a library preset against real content, with the scene's own timing. */
function Animated({ anim: animation, category, frames, content }: { anim: AnimationRef | null; category: string; frames: number; content: NonNullable<Parameters<(typeof RENDERERS)[string]>[0]["content"]> }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const resolved = presetFor(animation, category);
  if (!resolved) return null;
  const Renderer = RENDERERS[resolved.preset.implementation.renderer];
  if (!Renderer) return null;
  return <Renderer frame={frame} fps={fps} durationInFrames={frames} width={width} height={height} params={resolved.params} config={resolved.preset.implementation.config ?? {}} content={content} />;
}

function ElementView({ el, spec, frames, highlight }: { el: SpecElement; spec: CreativeSpecDoc; frames: number; highlight?: string | null }) {
  const outline: CSSProperties = highlight === el.id ? { outline: "3px solid #529cca", outlineOffset: 4 } : {};
  if (el.type === "image" || el.type === "logo") {
    if (!el.src) return null;
    const img = <Img src={el.src} style={{ width: "100%", height: "100%", objectFit: el.type === "logo" ? "contain" : "cover" }} />;
    const box: CSSProperties = el.type === "logo" ? { position: "absolute", left: "7%", top: "6%", width: "22%", height: "8%" } : { position: "absolute", ...REGION[el.layout] };
    return (
      <div style={{ ...box, overflow: "hidden", ...outline }}>
        {presetFor(el.animation, "image") ? <Animated anim={el.animation} category="image" frames={frames} content={{ node: img }} /> : img}
      </div>
    );
  }

  const isCta = el.type === "cta";
  const style: CSSProperties = {
    fontFamily: FONT_STACK[spec.style.font],
    fontSize: el.size ?? (el.type === "headline" ? 64 : 30),
    fontWeight: el.type === "headline" ? 750 : el.type === "cta" ? 700 : 500,
    color: isCta ? spec.style.background : spec.style.foreground,
    whiteSpace: "normal",
    lineHeight: el.type === "headline" ? 1.05 : 1.3,
    letterSpacing: el.type === "headline" ? "-0.025em" : "0",
    textAlign: el.layout === "lower-left" ? "left" : "center",
    ...(isCta ? { background: spec.style.accent, padding: "0.45em 1.1em", borderRadius: 999 } : {}),
  };
  const text = el.text ?? "";
  return (
    <div style={{ position: "absolute", ...REGION[el.layout], ...outline }}>
      {presetFor(el.animation, "text") ? (
        <Animated anim={el.animation} category="text" frames={frames} content={{ text, style, bare: true }} />
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={style}>{text}</div>
        </AbsoluteFill>
      )}
    </div>
  );
}

export function SceneView({ spec, scene, frames, highlight }: { spec: CreativeSpecDoc; scene: SpecScene; frames: number; highlight?: string | null }) {
  const order = (e: SpecElement) => (e.type === "image" ? 0 : e.type === "logo" ? 2 : 1);
  return (
    <AbsoluteFill style={{ background: scene.background.color || spec.style.background, overflow: "hidden" }}>
      {scene.background.preset && <Animated anim={scene.background.preset} category="background" frames={frames} content={{ node: <span /> }} />}
      {[...scene.elements].sort((a, b) => order(a) - order(b)).map((el) => (
        <ElementView key={el.id} el={el} spec={spec} frames={frames} highlight={highlight} />
      ))}
    </AbsoluteFill>
  );
}

export function SpecComposition({ spec, highlight }: SpecCompositionProps) {
  const { fps } = useVideoConfig();
  const offsets = sceneOffsets(spec);
  return (
    <AbsoluteFill style={{ background: spec.style.background }}>
      {spec.scenes.map((scene, i) => (
        <Sequence key={scene.id} from={offsets[i]!.from} durationInFrames={offsets[i]!.frames} name={scene.id}>
          <SceneView spec={spec} scene={scene} frames={offsets[i]!.frames} highlight={highlight} />
        </Sequence>
      ))}
      {spec.scenes.map((scene, i) => {
        const next = spec.scenes[i + 1];
        const t = presetFor(scene.transition, "transition");
        if (!t || !next) return null;
        const a = offsets[i]!;
        const b = offsets[i + 1]!;
        const want = Math.round(Number(t.params.duration ?? 0.8) * fps);
        const frames = Math.max(6, Math.min(want, Math.floor(a.frames * 0.8), Math.floor(b.frames * 0.8)));
        const half = Math.floor(frames / 2);
        return (
          <Sequence key={`${scene.id}-transition`} from={b.from - half} durationInFrames={frames} name={`${scene.id} → ${next.id}`}>
            <Animated
              anim={scene.transition}
              category="transition"
              frames={frames}
              content={{
                a: (
                  <Freeze frame={a.frames - half}>
                    <SceneView spec={spec} scene={scene} frames={a.frames} />
                  </Freeze>
                ),
                b: (
                  <Freeze frame={half}>
                    <SceneView spec={spec} scene={next} frames={b.frames} />
                  </Freeze>
                ),
              }}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
