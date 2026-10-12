import { z } from "zod";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { defineSkill } from "@/server/skills/types";

export const dnaSchema = z.object({
  headline: z.string(),
  dimensions: z.array(z.object({ key: z.enum(["typography", "color", "photography", "motion", "composition", "texture", "tone"]), direction: z.string(), evidence: z.array(z.string()) })),
  learnedFrom: z.array(z.object({ referenceId: z.string(), learned: z.string() })),
  avoid: z.array(z.string()),
  suggestedAnimations: z.array(z.string()),
});

export default defineSkill({
  id: "creative.creative-dna",
  input: z.object({
    projectName: z.string(),
    projectDescription: z.string().nullable(),
    direction: z.string().optional().describe("The chosen creative direction, if any"),
    references: z.array(z.object({ id: z.string(), title: z.string(), url: z.string(), analysis: z.unknown() })).min(2).max(24),
    memory: z.array(z.object({ kind: z.string(), title: z.string(), note: z.string().nullable() })).default([]),
  }),
  output: dnaSchema,
  cache: { ttlSeconds: 60 * 60 * 24 * 7 },
  async run(input, ctx) {
    const refs = input.references.map((r) => `[${r.id}] ${r.title} (${r.url})\n${JSON.stringify(r.analysis ?? {})}`).join("\n\n");
    const memory = input.memory.length ? `\n\nCompany creative memory:\n${input.memory.map((m) => `- ${m.kind}: ${m.title}${m.note ? ` (${m.note})` : ""}`).join("\n")}` : "";
    return ctx.ai.structured({
      schema: dnaSchema,
      effort: "high",
      system: ctx.instructions,
      cachedContext: ANIMATION_CATALOG_TEXT,
      content: `Project: ${input.projectName}${input.projectDescription ? `: ${input.projectDescription}` : ""}${input.direction ? `\nChosen direction: ${input.direction}` : ""}\n\nApproved references:\n\n${refs}${memory}`,
    });
  },
});
