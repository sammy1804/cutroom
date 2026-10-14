import { z } from "zod";

/**
 * CreativeObject: the real library item. A preview (rendered file) is only
 * how it looks in a list; the object is the source + the properties a
 * person may change + its timeline. See docs/ARTIFACT-ARCHITECTURE.md.
 */

export const CREATIVE_TYPES = ["TEMPLATE", "ANIMATION", "SCENE", "TRANSITION", "COMPOSITION", "ASSET", "3D", "AUDIO"] as const;

export const editablePropertySchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string(),
  type: z.enum(["text", "longText", "color", "image", "number", "select", "toggle"]),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  /** Groups the generated editor: Content, Look, Motion. */
  group: z.enum(["content", "look", "motion"]).default("content"),
});
export type EditableProperty = z.infer<typeof editablePropertySchema>;

export const creativeObjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(60),
  type: z.enum(CREATIVE_TYPES),
  category: z.string(),
  tags: z.array(z.string()),
  description: z.string().max(240),
  preview: z.object({ posterTime: z.number().nonnegative(), file: z.string().nullable().default(null) }),
  source: z.object({ engine: z.enum(["cutroom-canvas", "remotion"]), entry: z.string() }),
  editableProperties: z.array(editablePropertySchema).min(1),
  variants: z.array(z.object({ id: z.string(), name: z.string(), props: z.record(z.string(), z.unknown()) })).min(1),
  scenes: z.array(z.object({ id: z.string(), name: z.string(), start: z.number(), end: z.number() })),
  aspectRatios: z.array(z.enum(["16:9", "9:16", "1:1", "4:5"])).min(1),
  duration: z.number().positive(),
  style: z.array(z.string()).default([]),
  difficulty: z.enum(["simple", "standard", "advanced"]).default("standard"),
  version: z.number().int().positive(),
});
export type CreativeObject = z.infer<typeof creativeObjectSchema>;

/** A person's edit of an object: the object stays code; only choices are stored. */
export const creativeInstanceSchema = z.object({
  id: z.string(),
  objectId: z.string(),
  variant: z.string(),
  aspect: z.enum(["16:9", "9:16", "1:1", "4:5"]),
  props: z.record(z.string(), z.unknown()),
  name: z.string().optional(),
});
export type CreativeInstance = z.infer<typeof creativeInstanceSchema>;
