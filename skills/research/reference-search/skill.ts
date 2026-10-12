import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

export default defineSkill({
  id: "research.reference-search",
  input: z.object({
    query: z.string().max(300).default(""),
    projectId: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    limit: z.number().int().min(1).max(100).default(24),
  }),
  output: z.object({
    items: z.array(z.object({ id: z.string(), title: z.string(), url: z.string(), imageKey: z.string().nullable(), rank: z.number(), status: z.string(), tags: z.array(z.string()) })),
  }),
  async run(input, ctx) {
    const { listReferences } = await import("@/server/services/library");
    const rows = await listReferences(ctx.ws, { search: input.query, projectId: input.projectId, status: input.status, limit: input.limit });
    return { items: rows.map((r) => ({ id: r.id, title: r.title, url: r.url, imageKey: r.imageKey, rank: r.rank, status: r.status, tags: r.tags })) };
  },
});
