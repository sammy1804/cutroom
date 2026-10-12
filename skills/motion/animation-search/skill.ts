import { z } from "zod";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { getPreset } from "@/lib/animations/presets";
import { sanitizeParams } from "@/lib/animations/types";
import { defineSkill } from "@/server/skills/types";

const paramList = z.array(z.object({ key: z.string(), value: z.union([z.number(), z.string(), z.boolean()]) }));
const raw = z.object({
  interpretation: z.string(),
  recommendations: z.array(z.object({ presetId: z.string(), why: z.string(), params: paramList })),
  combinations: z.array(z.object({ name: z.string(), why: z.string(), layers: z.array(z.object({ presetId: z.string(), params: paramList })) })),
});
const params = z.record(z.string(), z.union([z.number(), z.string(), z.boolean()]));

export const animationSearchOutput = z.object({
  interpretation: z.string(),
  recommendations: z.array(z.object({ presetId: z.string(), name: z.string(), why: z.string(), params })),
  combinations: z.array(z.object({ name: z.string(), why: z.string(), layers: z.array(z.object({ presetId: z.string(), params })) })),
});

export default defineSkill({
  id: "motion.animation-search",
  input: z.object({ query: z.string().min(2).max(400), context: z.string().max(6000).optional() }),
  output: animationSearchOutput,
  cache: { ttlSeconds: 60 * 60 * 24 },
  async run({ query, context }, ctx) {
    const res = await ctx.ai.structured({ schema: raw, effort: "low", system: ctx.instructions, cachedContext: ANIMATION_CATALOG_TEXT, content: `${context ? `Context:\n${context}\n\n` : ""}Request: ${query}` });
    const tune = (id: string, list: { key: string; value: unknown }[]) => sanitizeParams(getPreset(id)!, Object.fromEntries(list.map((p) => [p.key, p.value])));
    return {
      interpretation: res.interpretation,
      recommendations: res.recommendations.filter((r) => getPreset(r.presetId)).map((r) => ({ presetId: r.presetId, name: getPreset(r.presetId)!.name, why: r.why, params: tune(r.presetId, r.params) })),
      combinations: res.combinations
        .map((c) => ({ ...c, layers: c.layers.filter((l) => getPreset(l.presetId)).map((l) => ({ presetId: l.presetId, params: tune(l.presetId, l.params) })) }))
        .filter((c) => c.layers.length > 1),
    };
  },
});
