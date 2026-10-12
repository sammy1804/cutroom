import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getAIProvider, type AIProvider } from "@/server/ai/provider";
import { sumUsage, withUsageCollector } from "@/server/ai/usage";
import { skillRun } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import type { WorkspaceContext } from "@/server/services/context";
import { getSkill } from "./registry";

/**
 * Skill runtime: validate input → cache → execute (with retries, timeout and
 * usage capture) → validate output → record a skill_run. Every execution is
 * observable: which skill, why, inputs, outputs, duration, provider, cost.
 */

export interface RunOptions {
  reason: string;
  projectId?: string | null;
  parentRunId?: string | null;
  workflowId?: string | null;
  useCache?: boolean;
  onProgress?: (percent: number) => Promise<void>;
  /** Override the configured provider (tests, or routing a run to a cheaper model). */
  ai?: AIProvider;
}

export interface RunResult<O> {
  output: O;
  runId: string;
  cached: boolean;
}

const MAX_STORED_BYTES = 120_000;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Large payloads are summarised, not stored whole. */
function storable(value: unknown) {
  const json = JSON.stringify(value ?? null);
  return json.length > MAX_STORED_BYTES ? { truncated: true, bytes: json.length, preview: json.slice(0, 2000) } : value;
}

const transient = (e: unknown) => e instanceof AppError && e.code === "PROVIDER_UNAVAILABLE" && /rate limit|unavailable right now/i.test(e.message);

export async function runSkill<O = unknown>(ws: WorkspaceContext, skillId: string, rawInput: unknown, opts: RunOptions): Promise<RunResult<O>> {
  const skill = getSkill(skillId);
  const def = skill.definition!;
  const meta = skill.meta;

  const parsed = def.input.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".") || "_"] ??= []).push(issue.message);
    throw new AppError("VALIDATION", `${meta.name} received invalid input.`, fieldErrors);
  }
  const input = parsed.data;
  const ai = opts.ai ?? getAIProvider();
  if ((meta.executor === "ai" || meta.executor === "hybrid") && !ai.available()) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Connect Claude to use this: add ANTHROPIC_API_KEY.");
  }
  const inputHash = createHash("sha256").update(stable({ id: meta.id, v: meta.version, input })).digest("hex");
  const base = {
    organizationId: ws.organization.id,
    projectId: opts.projectId ?? null,
    userId: ws.userId,
    skillId: meta.id,
    skillVersion: meta.version,
    reason: opts.reason.slice(0, 300),
    inputHash,
    input: storable(input),
    parentRunId: opts.parentRunId ?? null,
    workflowId: opts.workflowId ?? null,
  };

  // Cost control: identical input to a cacheable skill returns the stored result.
  if (def.cache && opts.useCache !== false) {
    const since = new Date(Date.now() - def.cache.ttlSeconds * 1000);
    const [hit] = await ws.db
      .select({ output: skillRun.output, id: skillRun.id })
      .from(skillRun)
      .where(and(eq(skillRun.organizationId, ws.organization.id), eq(skillRun.skillId, meta.id), eq(skillRun.inputHash, inputHash), eq(skillRun.status, "succeeded"), gt(skillRun.startedAt, since)))
      .orderBy(desc(skillRun.startedAt))
      .limit(1);
    const reuse = hit ? def.output.safeParse((hit.output as { result?: unknown } | null)?.result) : null;
    if (hit && reuse?.success) {
      const [row] = await ws.db.insert(skillRun).values({ ...base, status: "cached", output: { cachedFrom: hit.id }, finishedAt: new Date() }).returning({ id: skillRun.id });
      return { output: reuse.data as O, runId: row!.id, cached: true };
    }
  }

  const [row] = await ws.db.insert(skillRun).values({ ...base, status: "running" }).returning({ id: skillRun.id });
  const runId = row!.id;
  const started = Date.now();
  const logs: { at: number; message: string; data?: Record<string, unknown> }[] = [];
  let attempts = 0;

  try {
    const { result, usage } = await withUsageCollector(async () => {
      for (;;) {
        attempts++;
        try {
          const work = def.run(input, {
            ws,
            ai,
            instructions: skill.instructions,
            projectId: opts.projectId ?? null,
            runId,
            log: (message, data) => logs.push({ at: Date.now() - started, message, data }),
            progress: async (p) => opts.onProgress?.(p),
            runSkill: async <C>(id: string, childInput: unknown, reason: string) =>
              (await runSkill<C>(ws, id, childInput, { reason, projectId: opts.projectId, parentRunId: runId, workflowId: opts.workflowId, ai: opts.ai })).output,
          });
          return await (def.timeoutMs
            ? Promise.race([work, new Promise<never>((_, rej) => setTimeout(() => rej(new AppError("INTERNAL", `${meta.name} timed out.`)), def.timeoutMs))])
            : work);
        } catch (error) {
          if (attempts <= (def.retries ?? 1) && transient(error)) {
            logs.push({ at: Date.now() - started, message: "retrying after transient error", data: { error: String(error) } });
            await new Promise((r) => setTimeout(r, 1500 * attempts));
            continue;
          }
          throw error;
        }
      }
    });

    const checked = def.output.safeParse(result);
    const total = sumUsage(usage);
    if (!checked.success) {
      throw new AppError("INTERNAL", `${meta.name} produced output that didn't match its schema: ${z.prettifyError(checked.error).slice(0, 300)}`);
    }
    await ws.db
      .update(skillRun)
      .set({
        status: "succeeded",
        output: storable({ result: checked.data, logs }),
        provider: total.provider || null,
        model: total.model || null,
        inputTokens: total.inputTokens,
        outputTokens: total.outputTokens,
        costUsd: total.costUsd,
        durationMs: Date.now() - started,
        attempts,
        finishedAt: new Date(),
      })
      .where(eq(skillRun.id, runId));
    return { output: checked.data as O, runId, cached: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ws.db
      .update(skillRun)
      .set({ status: "failed", error: message.slice(0, 2000), output: storable({ logs }), durationMs: Date.now() - started, attempts, finishedAt: new Date() })
      .where(eq(skillRun.id, runId));
    throw error instanceof AppError ? error : new AppError("INTERNAL", `${meta.name} failed: ${message.slice(0, 200)}`);
  }
}
