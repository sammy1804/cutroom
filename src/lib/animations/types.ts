/**
 * Animation presets are procedural definitions, not rendered media.
 * A preset = metadata + a typed parameter schema + a pointer to a renderer
 * (lib/animations/renderers). The editor, previews and final render all run
 * the same renderer with the same parameters.
 */

export type AnimationCategory = "text" | "image" | "object" | "transition" | "background" | "3d" | "component";
export type ElementKind = "text" | "image" | "video" | "shape" | "scene" | "background" | "overlay";

export type EasingName = "linear" | "easeOut" | "easeInOut" | "expoOut" | "backOut" | "spring";
export const EASINGS: EasingName[] = ["linear", "easeOut", "easeInOut", "expoOut", "backOut", "spring"];

export type ParamDef =
  | { type: "number"; label: string; default: number; min: number; max: number; step?: number; unit?: string }
  | { type: "select"; label: string; default: string; options: readonly string[] }
  | { type: "color"; label: string; default: string }
  | { type: "boolean"; label: string; default: boolean }
  /** Editable copy for components: names, captions, numbers. */
  | { type: "text"; label: string; default: string; maxLength?: number };

export type ParamValues = Record<string, number | string | boolean>;

export type RendererId = string;

export interface AnimationPreset {
  id: string;
  name: string;
  category: AnimationCategory;
  description: string;
  /** Words for natural-language search: mood, feel, references. */
  moods: string[];
  version: number;
  compatibleElements: ElementKind[];
  parameters: Record<string, ParamDef>;
  preview: { sample: AnimationCategory; durationInFrames: number; /** Frame shown as the still poster. */ posterFrame: number };
  implementation: { renderer: RendererId; config?: Record<string, unknown> };
}

export function defaultsOf(preset: Pick<AnimationPreset, "parameters">): ParamValues {
  return Object.fromEntries(Object.entries(preset.parameters).map(([k, d]) => [k, d.default]));
}

/** Clamp/coerce user-supplied values against the schema; unknown keys are dropped. */
export function sanitizeParams(preset: Pick<AnimationPreset, "parameters">, input: Record<string, unknown>): ParamValues {
  const out = defaultsOf(preset);
  for (const [key, def] of Object.entries(preset.parameters)) {
    const v = input[key];
    if (v === undefined) continue;
    if (def.type === "number" && typeof v === "number" && Number.isFinite(v)) out[key] = Math.min(def.max, Math.max(def.min, v));
    if (def.type === "select" && typeof v === "string" && def.options.includes(v)) out[key] = v;
    if (def.type === "color" && typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) out[key] = v;
    if (def.type === "boolean" && typeof v === "boolean") out[key] = v;
    if (def.type === "text" && typeof v === "string") out[key] = v.slice(0, def.maxLength ?? 140);
  }
  return out;
}
