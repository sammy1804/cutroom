import { after } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { job, type Job, type JobKind } from "@/server/db/schema";
import { notFound } from "@/server/errors";
import type { WorkspaceContext } from "@/server/services/context";

/**
 * In-process job runner: records the job, responds immediately, and runs the
 * handler after the response with Next's `after()`. The `JobQueue` interface
 * in ./queue stays the contract for swapping in a durable queue later.
 */

export interface StartJobInput {
  kind: JobKind;
  input: Record<string, unknown>;
  projectId?: string | null;
  campaignId?: string | null;
}

export type JobWork = (report: (progress: number, note?: string) => Promise<void>, jobId: string) => Promise<Record<string, unknown>>;

/** Jobs left "running" this long (e.g. by a dev-server restart) are treated as failed. */
export const STALE_JOB_MS = 15 * 60 * 1000;

export async function startJob(ctx: WorkspaceContext, input: StartJobInput, work: JobWork, opts: { inline?: boolean } = {}) {
  const [created] = await ctx.db
    .insert(job)
    .values({
      organizationId: ctx.organization.id,
      projectId: input.projectId ?? null,
      campaignId: input.campaignId ?? null,
      kind: input.kind,
      provider: "anthropic",
      input: input.input,
      createdById: ctx.userId,
    })
    .returning();

  const run = () => executeJob(ctx, created!.id, work);
  if (opts.inline) await run();
  else after(run);
  return created!;
}

async function executeJob(ctx: WorkspaceContext, jobId: string, work: JobWork) {
  const set = (values: Partial<Job>) => ctx.db.update(job).set(values).where(eq(job.id, jobId));
  await set({ status: "running", startedAt: new Date(), attempts: 1 });
  try {
    const output = await work(async (progress, note) => {
      await set({ progress: Math.max(0, Math.min(100, Math.round(progress))), ...(note ? { error: null, output: { note } } : {}) });
    }, jobId);
    await set({ status: "succeeded", progress: 100, output, finishedAt: new Date() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[job ${jobId}] failed`, error);
    await set({ status: "failed", error: message, finishedAt: new Date() });
  }
}

export async function getJob(ctx: WorkspaceContext, id: string) {
  const [row] = await ctx.db
    .select()
    .from(job)
    .where(and(eq(job.id, id), eq(job.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Job");
  return withStaleness(row);
}

export async function latestJob(ctx: WorkspaceContext, filter: { kind: JobKind; campaignId?: string; projectId?: string }) {
  const conds = [eq(job.organizationId, ctx.organization.id), eq(job.kind, filter.kind)];
  if (filter.campaignId) conds.push(eq(job.campaignId, filter.campaignId));
  if (filter.projectId) conds.push(eq(job.projectId, filter.projectId));
  const [row] = await ctx.db.select().from(job).where(and(...conds)).orderBy(desc(job.createdAt)).limit(1);
  return row ? withStaleness(row) : null;
}

export async function recentJobs(ctx: WorkspaceContext, filter: { kind: JobKind; projectId?: string }, limit = 5) {
  const conds = [eq(job.organizationId, ctx.organization.id), eq(job.kind, filter.kind)];
  if (filter.projectId) conds.push(eq(job.projectId, filter.projectId));
  const rows = await ctx.db.select().from(job).where(and(...conds)).orderBy(desc(job.createdAt)).limit(limit);
  return rows.map(withStaleness);
}

function withStaleness(row: Job): Job {
  const active = row.status === "queued" || row.status === "running";
  if (active && Date.now() - new Date(row.createdAt).getTime() > STALE_JOB_MS) {
    return { ...row, status: "failed", error: "This run was interrupted. Start it again." };
  }
  return row;
}

export const isActive = (j: Pick<Job, "status"> | null | undefined) => j?.status === "queued" || j?.status === "running";
