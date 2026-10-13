import { z } from "zod";

/**
 * CreativeSpec: the single source of truth for a motion piece.
 * The Remotion preview and the final render both read this document; the
 * rendered MP4 is never the source of truth. Every scene and element has a
 * stable id (`scene_02`, `scene_02.headline`) so AI and people can change one
 * object without regenerating the rest.
 */

export const ASPECT = { "9:16": [720, 1280], "1:1": [1080, 1080], "4:5": [864, 1080], "16:9": [1280, 720] } as const;
export type Aspect = keyof typeof ASPECT;

export const animationRefSchema = z.object({
  presetId: z.string(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export const elementSchema = z.object({
  id: z.string().regex(/^scene_\d{2}\.[a-z][a-z0-9_]*$/, "Element ids look like scene_01.headline"),
  type: z.enum(["headline", "subtitle", "image", "logo", "cta", "lottie"]),
  text: z.string().max(240).optional(),
  /** Library asset id (image/logo/lottie) and its resolved URL. */
  assetId: z.string().optional(),
  src: z.string().optional(),
  /** Attribution the asset's licence requires (e.g. CC BY). Travels with the element into QC and exports. */
  credit: z.string().max(200).optional(),
  layout: z.enum(["center", "top", "bottom", "lower-left", "fullbleed"]).default("center"),
  /** Font size in composition pixels for text elements. */
  size: z.number().min(10).max(240).optional(),
  animation: animationRefSchema.nullable().default(null),
});

export const sceneSchema = z.object({
  id: z.string().regex(/^scene_\d{2}$/),
  purpose: z.enum(["hook", "context", "problem", "turn", "proof", "payoff", "cta", "outro"]).default("context"),
  duration: z.number().min(0.5).max(20),
  notes: z.string().max(500).optional(),
  camera: z.string().max(80).optional(),
  background: z
    .object({ color: z.string().default("#111111"), preset: animationRefSchema.nullable().default(null) })
    .default({ color: "#111111", preset: null }),
  elements: z.array(elementSchema).max(8),
  /** Transition into the next scene. */
  transition: animationRefSchema.nullable().default(null),
  audio: z.string().max(120).optional(),
});

export const creativeSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().max(120),
  aspect: z.enum(["9:16", "1:1", "4:5", "16:9"]),
  fps: z.literal(30),
  style: z.object({
    background: z.string(),
    foreground: z.string(),
    accent: z.string(),
    font: z.enum(["sans", "serif", "mono"]).default("sans"),
  }),
  scenes: z.array(sceneSchema).min(1).max(24),
});

export type AnimationRef = z.infer<typeof animationRefSchema>;
export type SpecElement = z.infer<typeof elementSchema>;
export type SpecScene = z.infer<typeof sceneSchema>;
export type CreativeSpecDoc = z.infer<typeof creativeSpecSchema>;

export const FONT_STACK = {
  sans: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', 'Iowan Old Style', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

export const sceneId = (n: number) => `scene_${String(n).padStart(2, "0")}`;

export function specDimensions(spec: Pick<CreativeSpecDoc, "aspect">) {
  const [width, height] = ASPECT[spec.aspect];
  return { width, height };
}

export function totalFrames(spec: Pick<CreativeSpecDoc, "scenes" | "fps">) {
  return Math.max(1, Math.round(spec.scenes.reduce((n, s) => n + s.duration, 0) * spec.fps));
}

/** Start frame of each scene. */
export function sceneOffsets(spec: Pick<CreativeSpecDoc, "scenes" | "fps">) {
  let at = 0;
  return spec.scenes.map((s) => {
    const from = at;
    at += Math.round(s.duration * spec.fps);
    return { id: s.id, from, frames: Math.round(s.duration * spec.fps) };
  });
}

/** Re-number scenes and element ids after insert/delete/reorder so ids stay stable and sequential. */
export function renumber(spec: CreativeSpecDoc): CreativeSpecDoc {
  return {
    ...spec,
    scenes: spec.scenes.map((s, i) => {
      const id = sceneId(i + 1);
      return { ...s, id, elements: s.elements.map((e) => ({ ...e, id: `${id}.${e.id.split(".")[1]}` })) };
    }),
  };
}
