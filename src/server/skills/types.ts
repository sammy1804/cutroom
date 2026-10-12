import type { z } from "zod";
import type { AIProvider } from "@/server/ai/provider";
import type { WorkspaceContext } from "@/server/services/context";

/**
 * Skill = one focused capability. Metadata lives in the skill's SKILL.md
 * frontmatter (readable on GitHub); the typed contract and `run` live in skill.ts.
 */

export const SKILL_CATEGORIES = ["research", "brand", "media", "creative", "motion", "production", "intelligence", "orchestration"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export interface SkillMeta {
  id: string;
  name: string;
  version: string;
  category: SkillCategory;
  description: string;
  /** inline = in the request; job = background job; worker = needs the media worker (not deployed yet). */
  runtime: "inline" | "job" | "worker";
  executor: "ai" | "deterministic" | "browser" | "hybrid";
  cost: "free" | "low" | "medium" | "high";
  status: "ready" | "planned";
  tags: string[];
  /** Domain types this skill reads and writes, used for discovery (e.g. "VideoAsset", "MotionDNA"). */
  consumes: string[];
  produces: string[];
  dependencies: string[];
  failures: string[];
}

export interface SkillContext {
  ws: WorkspaceContext;
  ai: AIProvider;
  /** The SKILL.md body: the skill's own instructions, loaded only when it runs. */
  instructions: string;
  projectId: string | null;
  runId: string;
  log(message: string, data?: Record<string, unknown>): void;
  progress(percent: number): Promise<void>;
  /** Call another skill as a child run (shows up nested in Activity). */
  runSkill<O = unknown>(skillId: string, input: unknown, reason: string): Promise<O>;
}

export interface SkillDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  id: string;
  input: I;
  output: O;
  /** Identical input within this window returns the stored result instead of re-running (cost control). */
  cache?: { ttlSeconds: number };
  /** Extra attempts after a transient failure. */
  retries?: number;
  timeoutMs?: number;
  run(input: z.output<I>, ctx: SkillContext): Promise<z.input<O>>;
}

export function defineSkill<I extends z.ZodType, O extends z.ZodType>(def: SkillDefinition<I, O>): SkillDefinition<I, O> {
  return def;
}

export interface RegisteredSkill {
  meta: SkillMeta;
  instructions: string;
  definition: SkillDefinition | null;
}
