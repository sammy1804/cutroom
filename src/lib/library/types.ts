import { z } from "zod";
import type { CreativeSpecDoc } from "@/lib/creative-spec/schema";
import { ASPECTS, TEMPLATE_CATEGORIES } from "./taxonomy";

/**
 * Library entries. A Template is an editable composition: a builder that
 * turns editable field values into a CreativeSpec, plus metadata, curated
 * demo content and a rendered preview. The MP4 is only the preview; the
 * source is the builder + fields + assets.
 */

export type LibraryKind = "template" | "animation" | "scene" | "transition" | "asset" | "audio";

export const editableFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string(),
  type: z.enum(["text", "longText", "image", "logo", "color", "number", "select"]),
  /** Demo value used for the preview: art-directed, never lorem ipsum. */
  default: z.union([z.string(), z.number()]),
  maxLength: z.number().optional(),
  options: z.array(z.string()).optional(),
  hint: z.string().optional(),
});
export type EditableField = z.infer<typeof editableFieldSchema>;

/** The ten criteria every template is scored on, 1–5 each. */
export const QUALITY_CRITERIA = ["composition", "typography", "motion", "pacing", "hierarchy", "usefulness", "editability", "originality", "responsiveness", "preview"] as const;
export type QualityScore = Record<(typeof QUALITY_CRITERIA)[number], number> & { reviewer: string; reviewedAt: string; notes?: string };

export const templateMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3).max(60),
  category: z.enum(TEMPLATE_CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  subcategory: z.string().max(40).optional(),
  description: z.string().min(20).max(240),
  aspectRatios: z.array(z.enum(ASPECTS)).min(1),
  durationOptions: z.array(z.number().positive()).min(1),
  styleTags: z.array(z.string()).min(1),
  industryTags: z.array(z.string()),
  editableFields: z.array(editableFieldSchema).min(1),
  /** Scene roles in order, so scenes can be swapped between templates. */
  sceneRoles: z.array(z.enum(["opening", "typography", "reveal", "feature", "proof", "transition", "cta", "outro"])).min(1),
  preview: z.object({ video: z.string().nullable(), poster: z.string().nullable() }),
  version: z.number().int().positive(),
  author: z.string(),
  license: z.string(),
  status: z.enum(["draft", "review", "published", "rejected"]),
});
export type TemplateMeta = z.infer<typeof templateMetaSchema> & { quality?: QualityScore };

export type FieldValues = Record<string, string | number>;

export interface TemplateDefinition {
  meta: TemplateMeta;
  /** Pure: field values + format → the editable CreativeSpec. */
  build(fields: FieldValues, options: { aspect: (typeof ASPECTS)[number]; duration: number }): CreativeSpecDoc;
}

/**
 * The quality gate: a template is publishable only when it has been reviewed,
 * averages at least 4 of 5, and no single criterion is below 3.
 */
export function passesQualityGate(score: QualityScore | undefined): { ok: boolean; average: number; weakest: string | null } {
  if (!score) return { ok: false, average: 0, weakest: null };
  const values = QUALITY_CRITERIA.map((c) => score[c]);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const weakestIndex = values.indexOf(Math.min(...values));
  const weakest = values[weakestIndex]! < 3 ? QUALITY_CRITERIA[weakestIndex]! : null;
  return { ok: average >= 4 && !weakest, average, weakest };
}

/** Field values with defaults filled in and unknown keys dropped. */
export function resolveFields(fields: EditableField[], input: FieldValues = {}): FieldValues {
  return Object.fromEntries(fields.map((f) => [f.key, input[f.key] ?? f.default]));
}
