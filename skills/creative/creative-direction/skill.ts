import { z } from "zod";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { defineSkill } from "@/server/skills/types";
import { directionSchema } from "../brainstorm/skill";

const directionsSchema = z.object({ directions: z.array(directionSchema).min(1).max(4) });

export default defineSkill({
  id: "creative.creative-direction",
  input: z.object({
    idea: z.string().min(3).max(3000),
    audience: z.string().max(500).optional(),
    format: z.string().default("9:16"),
    research: z.string().max(6000).optional().describe("Research summary and insights"),
    references: z.array(z.object({ title: z.string(), learnings: z.array(z.string()), motion: z.string().optional() })).max(16).default([]),
    memory: z.array(z.string()).max(30).default([]).describe("Company's previously approved creative decisions"),
  }),
  output: directionsSchema,
  async run(input, ctx) {
    return ctx.ai.structured({
      schema: directionsSchema,
      effort: "medium",
      system: ctx.instructions,
      cachedContext: ANIMATION_CATALOG_TEXT,
      content: [
        `Idea: ${input.idea}`,
        input.audience && `Audience: ${input.audience}`,
        `Format: ${input.format}`,
        input.research && `Research:\n${input.research}`,
        input.references.length ? `Approved references:\n${input.references.map((r, i) => `REF ${String(i + 1).padStart(2, "0")} ${r.title}: ${r.learnings.join("; ")}${r.motion ? ` (motion: ${r.motion})` : ""}`).join("\n")}` : "",
        input.memory.length ? `Company creative memory (respect unless the idea demands otherwise):\n- ${input.memory.join("\n- ")}` : "",
        "Return exactly three directions.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  },
});
