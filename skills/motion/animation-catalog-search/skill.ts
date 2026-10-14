import { z } from "zod";
import { LIBRARY_PRESETS as ANIMATION_PRESETS } from "@/lib/library/curation";
import { defineSkill } from "@/server/skills/types";

export default defineSkill({
  id: "motion.animation-catalog-search",
  input: z.object({
    query: z.string().max(200),
    category: z.enum(["text", "image", "object", "transition", "background", "3d", "component"]).optional(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  output: z.object({ presets: z.array(z.object({ id: z.string(), name: z.string(), category: z.string(), score: z.number() })) }),
  async run({ query, category, limit }) {
    const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const scored = ANIMATION_PRESETS.filter((p) => !category || p.category === category)
      .map((p) => {
        let score = words.length ? 0 : 1;
        for (const w of words) {
          if (p.name.toLowerCase().includes(w)) score += 3;
          if (p.moods.some((m) => m.includes(w))) score += 2;
          if (p.description.toLowerCase().includes(w)) score += 1;
        }
        return { id: p.id, name: p.name, category: p.category, score };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score);
    return { presets: scored.slice(0, limit) };
  },
});
