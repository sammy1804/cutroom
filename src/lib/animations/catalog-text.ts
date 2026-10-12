import { ANIMATION_PRESETS } from "./presets";

/** Compact, stable catalog for Claude prompts (kept byte-identical so it caches). */
export const ANIMATION_CATALOG_TEXT =
  "Animation library catalog (id | name | category | description | moods | parameters):\n" +
  ANIMATION_PRESETS.map(
    (p) =>
      `${p.id} | ${p.name} | ${p.category} | ${p.description} | ${p.moods.join(", ")} | ${Object.entries(p.parameters)
        .map(([k, d]) => (d.type === "number" ? `${k} ${d.min}–${d.max}${d.unit ?? ""}` : d.type === "select" ? `${k} [${d.options.join("/")}]` : d.type === "text" ? `${k} text` : `${k} ${d.type}`))
        .join("; ")}`,
  ).join("\n");
