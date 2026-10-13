import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

export default defineSkill({
  id: "library.open-library-search",
  input: z.object({
    query: z.string().max(200).default(""),
    kind: z.enum(["lottie", "texture", "hdri"]).optional(),
    limit: z.number().int().min(1).max(96).default(24),
  }),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        name: z.string(),
        source: z.string(),
        thumbnailUrl: z.string().nullable(),
        license: z.string(),
        credit: z.string(),
        attributionRequired: z.boolean(),
      }),
    ),
  }),
  async run({ query, kind, limit }, ctx) {
    const { searchOpenLibrary } = await import("@/server/services/open-library");
    const { items } = await searchOpenLibrary(ctx.ws, { q: query, kind, limit });
    return {
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        name: i.name,
        source: i.source,
        thumbnailUrl: i.thumbnailUrl,
        license: i.rights.license,
        credit: i.rights.credit,
        attributionRequired: i.rights.attributionRequired,
      })),
    };
  },
});
