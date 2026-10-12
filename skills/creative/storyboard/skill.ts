import { z } from "zod";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { defineSkill } from "@/server/skills/types";
import { directionSchema } from "../brainstorm/skill";

export const shotSchema = z.object({
  purpose: z.enum(["hook", "context", "problem", "turn", "proof", "payoff", "cta", "outro"]),
  duration: z.number().min(0.6).max(8),
  headline: z.string(),
  subtitle: z.string().optional(),
  layout: z.enum(["center", "top", "bottom", "lower-left", "fullbleed"]),
  camera: z.string().describe("e.g. static, slow push, pan left"),
  visual: z.string().describe("Image needed for the shot, or 'none'"),
  animation: z.string().describe("Text animation preset id"),
  imageAnimation: z.string().optional().describe("Image animation preset id when there is a visual"),
  background: z.string().describe("Hex colour or background preset id"),
  transition: z.string().nullable().describe("Transition preset id into the next shot, or null for a cut"),
  audio: z.string().describe("Music/sound note, e.g. 'beat hit', 'riser', 'silence'"),
});

export const storyboardSchema = z.object({ title: z.string(), shots: z.array(shotSchema).min(2).max(16) });
export type Storyboard = z.infer<typeof storyboardSchema>;

export default defineSkill({
  id: "creative.storyboard",
  input: z.object({
    idea: z.string().min(3).max(3000),
    direction: directionSchema,
    format: z.string().default("9:16"),
    targetSeconds: z.number().min(5).max(90).default(15),
    dna: z.string().max(3000).optional(),
    brandName: z.string().optional(),
  }),
  output: storyboardSchema,
  async run(input, ctx) {
    return ctx.ai.structured({
      schema: storyboardSchema,
      effort: "medium",
      system: ctx.instructions,
      cachedContext: ANIMATION_CATALOG_TEXT,
      content: [
        `Idea: ${input.idea}`,
        input.brandName && `Brand: ${input.brandName}`,
        `Direction: ${input.direction.title}: ${input.direction.premise}\nVisual territory: ${input.direction.visualTerritory}\nStorytelling: ${input.direction.storytelling}\nTone: ${input.direction.tone}\nPalette: ${input.direction.palette.join(", ")}\nMotion: ${input.direction.motion.join(", ")}`,
        input.dna && `CreativeDNA:\n${input.dna}`,
        `Format ${input.format}, target length ${input.targetSeconds}s.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  },
});
