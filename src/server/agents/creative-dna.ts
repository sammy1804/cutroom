import "server-only";
import { z } from "zod";
import { structured } from "@/server/ai/claude";
import type { Reference } from "@/server/db/schema";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";

/** Visual research → CreativeDNA: what the approved references taught us, as direction. */

const dnaSchema = z.object({
  headline: z.string().describe("One sentence that captures the creative direction"),
  dimensions: z.array(
    z.object({
      key: z.enum(["typography", "color", "photography", "motion", "composition", "texture", "tone"]),
      direction: z.string(),
      evidence: z.array(z.string()).describe("Reference ids that support this"),
    }),
  ),
  learnedFrom: z.array(z.object({ referenceId: z.string(), learned: z.string().describe("What this specific reference taught us") })),
  avoid: z.array(z.string()),
  suggestedAnimations: z.array(z.string()).describe("Animation preset ids from the catalog that fit this direction"),
});

export async function synthesizeCreativeDNA(input: {
  projectName: string;
  projectDescription: string | null;
  references: Pick<Reference, "id" | "title" | "url" | "analysis">[];
  companyMemory: { kind: string; title: string; note: string | null }[];
}) {
  const refs = input.references
    .map((r) => {
      const a = r.analysis;
      return `[${r.id}] ${r.title} (${r.url})\n${a ? `composition: ${a.composition}\npalette: ${a.palette.join(", ")}\ntypography: ${a.typography}\nmotion: ${a.motion}\nart direction: ${a.artDirection}\nphotography: ${a.photography}\nlearnings: ${a.learnings.join(" | ")}` : "no analysis"}`;
    })
    .join("\n\n");
  const memory = input.companyMemory.length
    ? `\n\nThe company's previously approved creative decisions (respect these unless the references clearly say otherwise):\n${input.companyMemory.map((m) => `- ${m.kind}: ${m.title}${m.note ? ` — ${m.note}` : ""}`).join("\n")}`
    : "";

  return structured({
    schema: dnaSchema,
    effort: "high",
    system:
      "You are a creative director. Distil approved visual references into CreativeDNA: a small set of clear, " +
      "reusable directions for video. Explain what was learned from each reference rather than describing it. " +
      "Only cite reference ids and animation ids that appear in the input.",
    cachedContext: ANIMATION_CATALOG_TEXT,
    content: `Project: ${input.projectName}${input.projectDescription ? ` — ${input.projectDescription}` : ""}\n\nApproved references:\n\n${refs}${memory}`,
  });
}
