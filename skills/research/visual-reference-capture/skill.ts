import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

export default defineSkill({
  id: "research.visual-reference-capture",
  input: z.object({
    url: z.string().url(),
    brief: z.string().max(4000),
    projectId: z.string().nullable(),
    campaignId: z.string().nullable().default(null),
    jobId: z.string().default(""),
  }),
  output: z.object({ referenceIds: z.array(z.string()) }),
  timeoutMs: 240_000,
  async run(input, ctx) {
    const { captureReference } = await import("@/server/agents/browser-research");
    return captureReference(ctx.ws, { ...input, instructions: ctx.instructions, ai: ctx.ai }, ctx.progress);
  },
});
