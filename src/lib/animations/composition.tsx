import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getPreset } from "./presets";
import { RENDERERS } from "./renderers";
import { sanitizeParams, type ParamValues } from "./types";

export interface AnimationLayer {
  presetId: string;
  params?: Record<string, unknown>;
}

export interface StackProps extends Record<string, unknown> {
  layers: AnimationLayer[];
  text?: string;
}

/**
 * Renders one preset or a combination. Text presets driven by the shared
 * `units` engine merge into a single animation (their channels add up, e.g.
 * Character Stagger + Blur In + Tracking Reveal); everything else stacks with
 * backgrounds at the bottom.
 */
export function AnimationStack({ layers, text }: StackProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const resolved = layers
    .map((l) => {
      const preset = getPreset(l.presetId);
      return preset ? { preset, params: sanitizeParams(preset, l.params ?? {}) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const base = { frame, fps, durationInFrames, width, height, content: text ? { text } : undefined };
  const unitLayers = resolved.filter((r) => r.preset.implementation.renderer === "units");
  const others = resolved
    .filter((r) => r.preset.implementation.renderer !== "units")
    .sort((a, b) => Number(b.preset.category === "background") - Number(a.preset.category === "background"));

  const hasBackdrop = resolved.some((r) => ["background", "image", "transition", "object", "3d"].includes(r.preset.category));

  let mergedText = null;
  if (unitLayers.length) {
    const [first, ...rest] = unitLayers;
    const config: Record<string, unknown> = { ...first!.preset.implementation.config };
    for (const r of rest) {
      for (const [k, v] of Object.entries(r.preset.implementation.config ?? {})) {
        if (k === "unit" || k === "out" || k === "forceEasing") continue;
        config[k] = typeof v === "number" && typeof config[k] === "number" ? Math.max(Number(config[k]), v) : (config[k] ?? v);
      }
    }
    const Units = RENDERERS.units!;
    mergedText = <Units {...base} params={first!.params} config={config} />;
  }

  return (
    <AbsoluteFill style={{ background: hasBackdrop ? undefined : "radial-gradient(circle at 50% 35%, #2a2520, #0f0d0b)" }}>
      {others.map((r, i) => {
        const Renderer = RENDERERS[r.preset.implementation.renderer];
        if (!Renderer) return null;
        return (
          <AbsoluteFill key={i}>
            <Renderer
              {...base}
              // Hide a background's placeholder title when real text is layered on top.
              content={r.preset.category === "background" && unitLayers.length ? { text, node: <span /> } : base.content}
              params={r.params as ParamValues}
              config={r.preset.implementation.config ?? {}}
            />
          </AbsoluteFill>
        );
      })}
      {mergedText}
    </AbsoluteFill>
  );
}

export const PREVIEW = { width: 640, height: 360, fps: 30, durationInFrames: 90 } as const;
