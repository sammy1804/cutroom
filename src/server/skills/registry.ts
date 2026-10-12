import { SKILLS } from "@skills/registry.generated";
import { AppError } from "@/server/errors";
import type { RegisteredSkill, SkillCategory, SkillMeta } from "./types";

/** The Skill Registry: every skill's metadata, discoverable without loading its instructions. */

export function listSkills(opts: { includePlanned?: boolean } = {}): SkillMeta[] {
  return SKILLS.filter((s) => opts.includePlanned || s.meta.status === "ready").map((s) => s.meta);
}

export function getSkill(id: string): RegisteredSkill {
  const skill = SKILLS.find((s) => s.meta.id === id);
  if (!skill) throw new AppError("NOT_FOUND", `No skill called "${id}".`);
  if (skill.meta.status !== "ready" || !skill.definition) {
    throw new AppError("NOT_IMPLEMENTED", `"${skill.meta.name}" is planned but not built yet.`);
  }
  return skill;
}

export interface DiscoveryQuery {
  query?: string;
  category?: SkillCategory;
  /** Skills that accept this domain type, e.g. "VideoAsset". */
  consumes?: string;
  /** Skills that produce this domain type, e.g. "MotionDNA". */
  produces?: string;
  includePlanned?: boolean;
  limit?: number;
}

export interface DiscoveredSkill {
  meta: SkillMeta;
  score: number;
  why: string[];
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
const STOP = new Set(["the", "and", "for", "this", "that", "with", "can", "help", "which", "what", "how", "from", "into", "make", "me", "skills", "skill"]);

/**
 * Finds the few skills relevant to a request: lexical match over name, tags and
 * description, plus typed input/output matching. Deterministic and free, so the
 * orchestrator only ever loads the instructions of skills it will actually run.
 */
export function discoverSkills(q: DiscoveryQuery): DiscoveredSkill[] {
  const words = tokens(q.query ?? "");
  const results: DiscoveredSkill[] = [];
  for (const { meta } of SKILLS) {
    if (!q.includePlanned && meta.status !== "ready") continue;
    if (q.category && meta.category !== q.category) continue;
    if (q.consumes && !meta.consumes.includes(q.consumes)) continue;
    if (q.produces && !meta.produces.includes(q.produces)) continue;
    const why: string[] = [];
    let score = q.consumes || q.produces || q.category ? 1 : 0;
    const name = tokens(meta.name);
    const tags = meta.tags.flatMap(tokens);
    const desc = tokens(meta.description);
    const types = [...meta.consumes, ...meta.produces].flatMap(tokens);
    for (const w of words) {
      const stem = (t: string) => t.startsWith(w.slice(0, 5)) || w.startsWith(t.slice(0, 5));
      const hit = name.some(stem) ? ["name", 3] : tags.some(stem) ? ["tag", 2] : types.some(stem) ? ["type", 2] : desc.some(stem) ? ["description", 1] : null;
      if (hit) {
        score += hit[1] as number;
        why.push(`${hit[0]}: ${w}`);
      }
    }
    if (score > 0) results.push({ meta, score: meta.status === "planned" ? score - 0.5 : score, why });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, q.limit ?? 8);
}
