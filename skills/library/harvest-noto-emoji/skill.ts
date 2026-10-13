import { z } from "zod";
import { defineSkill } from "@/server/skills/types";
import { harvestSummary } from "../harvest-polyhaven/skill";

export default defineSkill({
  id: "library.harvest-noto-emoji",
  input: z.object({}).default({}),
  output: harvestSummary,
  retries: 1,
  timeoutMs: 60_000,
  async run(_input, ctx) {
    const { fetchNotoIndex, normalizeNoto } = await import("@/server/library/noto");
    const { httpJson } = await import("@/server/library/types");
    const { upsertHarvest } = await import("@/server/services/open-library");
    const icons = await fetchNotoIndex(httpJson);
    if (icons.length === 0) throw new Error("EMPTY_INDEX: the Noto index has no icons");
    ctx.log(`Fetched ${icons.length} animated emoji`);
    const summary = await upsertHarvest(ctx.ws, "noto-emoji", icons.map(normalizeNoto));
    await ctx.progress(100);
    return { source: "noto-emoji", ...summary };
  },
});
