import { passesQualityGate, templateMetaSchema, type TemplateDefinition } from "./types";

/**
 * Built-in templates. Each lives in its own module under ./templates and is
 * added here only after it has been rendered, reviewed and scored. Drafts
 * can be registered for internal review but never appear in the Library.
 */
export const TEMPLATES: TemplateDefinition[] = [];

export function validateTemplate(t: TemplateDefinition) {
  const meta = templateMetaSchema.parse(t.meta);
  if (meta.status === "published" && !passesQualityGate(t.meta.quality).ok) {
    throw new Error(`Template "${meta.id}" is marked published but doesn't pass the quality gate.`);
  }
  return meta;
}

/** What the Library shows: published templates that pass the gate. */
export function publishedTemplates(): TemplateDefinition[] {
  return TEMPLATES.filter((t) => t.meta.status === "published" && passesQualityGate(t.meta.quality).ok);
}
