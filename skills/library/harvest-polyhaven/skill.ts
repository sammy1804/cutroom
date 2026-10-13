import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

export const harvestSummary = z.object({
  source: z.string(),
  total: z.number(),
  added: z.number(),
  updated: z.number(),
  unchanged: z.number(),
  retired: z.number(),
});

export default defineSkill({
  id: "library.harvest-polyhaven",
  input: z.object({ types: z.array(z.enum(["textures", "hdris"])).min(1).default(["textures", "hdris"]) }),
  output: z.object({ results: z.array(harvestSummary.extend({ type: z.string() })) }),
  retries: 1,
  timeoutMs: 120_000,
  async run({ types }, ctx) {
    const { fetchPolyHavenIndex, normalizePolyHaven } = await import("@/server/library/polyhaven");
    const { httpJson } = await import("@/server/library/types");
    const { upsertHarvest } = await import("@/server/services/open-library");
    const results = [];
    for (const [n, type] of types.entries()) {
      const index = await fetchPolyHavenIndex(type, httpJson);
      const items = Object.entries(index)
        .map(([slug, a]) => normalizePolyHaven(slug, a))
        .filter((i): i is NonNullable<typeof i> => i !== null);
      if (items.length === 0) throw new Error(`EMPTY_INDEX: Poly Haven returned no ${type}`);
      ctx.log(`Fetched ${items.length} ${type}`);
      const summary = await upsertHarvest(ctx.ws, "polyhaven", items, { kinds: [type === "hdris" ? "hdri" : "texture"] });
      ctx.log(`Synced ${type}`, { ...summary });
      results.push({ source: "polyhaven", type, ...summary });
      await ctx.progress(((n + 1) / types.length) * 100);
    }
    return { results };
  },
});
