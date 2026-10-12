import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

export const routeSchema = z.object({
  intent: z.enum(["animations", "assets", "references", "research", "creative_dna", "answer"]),
  query: z.string(),
  mediaType: z.enum(["image", "video", "audio", "any"]),
  answer: z.string(),
});

export default defineSkill({
  id: "orchestration.command-route",
  input: z.object({ text: z.string().min(2).max(600), where: z.string().max(400) }),
  output: routeSchema,
  async run({ text, where }, ctx) {
    return ctx.ai.structured({ schema: routeSchema, effort: "low", maxTokens: 2000, system: ctx.instructions, content: `Where the user is: ${where}\n\nRequest: ${text}` });
  },
});
