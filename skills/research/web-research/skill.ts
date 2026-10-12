import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

export const researchReportSchema = z.object({
  summary: z.string(),
  audience: z.array(z.object({ insight: z.string(), implication: z.string() })),
  competitors: z.array(z.object({ name: z.string(), url: z.string(), approach: z.string(), opening: z.string() })),
  trends: z.array(z.object({ trend: z.string(), evidence: z.string() })),
  hooks: z.array(z.string()),
  visualDirections: z.array(z.string()),
  referenceLeads: z.array(z.object({ url: z.string(), why: z.string() })),
  sources: z.array(z.object({ url: z.string(), title: z.string() })),
});

export default defineSkill({
  id: "research.web-research",
  input: z.object({
    question: z.string().min(3).max(2000).describe("What to research"),
    context: z.string().max(4000).optional().describe("Brief, brand, audience and channels"),
  }),
  output: researchReportSchema,
  cache: { ttlSeconds: 60 * 60 * 24 },
  timeoutMs: 280_000,
  async run({ question, context }, ctx) {
    await ctx.progress(10);
    const notes = await ctx.ai.research({
      system: ctx.instructions,
      prompt:
        `${context ? `Context:\n${context}\n\n` : ""}Research: ${question}\n\n` +
        "Cover the audience (motivations, objections, language), 3–5 competitors or adjacent brands and how they show up " +
        "in video, current creative and platform trends, and public pages worth capturing as visual references. Finish " +
        "with hook ideas and visual directions grounded in what you found.",
      effort: "high",
    });
    ctx.log("web research finished", { sources: notes.sources.length });
    await ctx.progress(75);
    const report = await ctx.ai.structured({
      schema: researchReportSchema,
      effort: "low",
      system: "Convert research notes into the requested structure. Keep every claim faithful to the notes; do not invent sources.",
      content: `Research notes:\n\n${notes.text}\n\nSources found:\n${notes.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`,
    });
    const seen = new Set(report.sources.map((s) => s.url));
    for (const s of notes.sources) if (!seen.has(s.url)) report.sources.push(s);
    return report;
  },
});
