import "server-only";
import { z } from "zod";
import { structured } from "@/server/ai/claude";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { getPreset } from "@/lib/animations/presets";
import { sanitizeParams, type ParamValues } from "@/lib/animations/types";

/** Natural-language search over the animation library, with combinations and tuned parameters. */

const paramList = z.array(z.object({ key: z.string(), value: z.union([z.number(), z.string(), z.boolean()]) }));

const searchSchema = z.object({
  interpretation: z.string().describe("One sentence: what the user is really asking for"),
  recommendations: z.array(z.object({ presetId: z.string(), why: z.string(), params: paramList })).describe("Best 3–6 single presets, best first"),
  combinations: z
    .array(z.object({ name: z.string(), why: z.string(), layers: z.array(z.object({ presetId: z.string(), params: paramList })) }))
    .describe("0–3 combinations of presets that together achieve the request"),
});

export interface AnimationPick {
  presetId: string;
  name: string;
  why: string;
  params: ParamValues;
}

export interface AnimationSearchResult {
  interpretation: string;
  recommendations: AnimationPick[];
  combinations: { name: string; why: string; layers: { presetId: string; params: ParamValues }[] }[];
}

export async function searchAnimations(query: string, context?: string): Promise<AnimationSearchResult> {
  const raw = await structured({
    schema: searchSchema,
    effort: "low",
    system:
      "You are a motion designer who knows this studio's animation library by heart. Map requests about feel " +
      "(subtle, editorial, liquid, energetic…) to presets, tune parameters to match, and combine presets when one " +
      "isn't enough. Only use preset ids and parameter keys from the catalog. Prefer restraint unless asked for energy.",
    cachedContext: ANIMATION_CATALOG_TEXT,
    content: `${context ? `Context:\n${context}\n\n` : ""}Request: ${query}`,
  });

  const toParams = (presetId: string, list: { key: string; value: unknown }[]) => {
    const preset = getPreset(presetId)!;
    return sanitizeParams(preset, Object.fromEntries(list.map((p) => [p.key, p.value])));
  };

  return {
    interpretation: raw.interpretation,
    recommendations: raw.recommendations
      .filter((r) => getPreset(r.presetId))
      .map((r) => ({ presetId: r.presetId, name: getPreset(r.presetId)!.name, why: r.why, params: toParams(r.presetId, r.params) })),
    combinations: raw.combinations
      .map((c) => ({ ...c, layers: c.layers.filter((l) => getPreset(l.presetId)).map((l) => ({ presetId: l.presetId, params: toParams(l.presetId, l.params) })) }))
      .filter((c) => c.layers.length > 1),
  };
}
