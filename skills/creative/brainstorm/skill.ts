import { z } from "zod";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { defineSkill } from "@/server/skills/types";

export const directionSchema = z.object({
  id: z.string().describe("Short slug, e.g. 'invisible-mountain'"),
  title: z.string(),
  premise: z.string(),
  why: z.string(),
  visualTerritory: z.string(),
  storytelling: z.string(),
  tone: z.string(),
  palette: z.array(z.string()).describe("3–5 hex colours"),
  motion: z.array(z.string()).describe("Animation preset ids from the catalog"),
  references: z.array(z.string()).describe("Real campaigns, artists or works to look at"),
});

const turnSchema = z.object({ role: z.enum(["user", "brain"]), text: z.string() });

export const brainReplySchema = z.object({
  reply: z.string(),
  directions: z.array(directionSchema),
  insights: z.array(z.object({ title: z.string(), detail: z.string(), source: z.string().optional() })),
  questions: z.array(z.string()),
});

export default defineSkill({
  id: "creative.brainstorm",
  input: z.object({
    idea: z.string().min(3).max(3000),
    action: z.enum(["brainstorm", "why", "another", "research", "stronger", "different", "references"]).default("brainstorm"),
    message: z.string().max(2000).optional(),
    focus: directionSchema.optional().describe("The direction a follow-up refers to"),
    history: z.array(turnSchema).max(30).default([]),
    previousTitles: z.array(z.string()).default([]),
  }),
  output: brainReplySchema,
  async run(input, ctx) {
    let notes = "";
    if (input.action === "research" || input.action === "references") {
      const found = await ctx.ai.research({
        system: "You research ideas for a creative team: facts, statistics, notable campaigns and visual references. Cite sources.",
        prompt: `${input.action === "references" ? "Find visual and campaign references" : "Research facts, statistics and campaigns"} for: ${input.focus ? `${input.focus.title}: ${input.focus.premise}` : input.idea}`,
        effort: "medium",
        maxSearches: 5,
      });
      notes = `Research notes:\n${found.text}\nSources:\n${found.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`;
      ctx.log("research for brainstorm", { sources: found.sources.length });
    }
    const history = input.history.map((t) => `${t.role === "user" ? "Designer" : "You"}: ${t.text}`).join("\n");
    return ctx.ai.structured({
      schema: brainReplySchema,
      effort: "medium",
      system: ctx.instructions,
      cachedContext: ANIMATION_CATALOG_TEXT,
      content: [
        `Idea: ${input.idea}`,
        history && `Conversation so far:\n${history}`,
        input.previousTitles.length ? `Directions already proposed: ${input.previousTitles.join(", ")}` : "",
        input.focus ? `Referenced direction: ${JSON.stringify(input.focus)}` : "",
        notes,
        `Action: ${input.action}${input.message ? `. Designer says: ${input.message}` : ""}`,
        input.action === "brainstorm" || input.action === "different" ? "Return exactly three directions." : "",
        input.action === "another" || input.action === "stronger" ? "Return exactly one direction." : "",
        input.action === "why" ? "Return no new directions; explain in the reply." : "",
        input.action === "research" || input.action === "references" ? "Return insights grounded in the notes, each with its source URL; directions optional." : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  },
});
