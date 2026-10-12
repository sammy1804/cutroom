import type { Job, JobKind } from "@/server/db/schema";

/**
 * Background work contract (Phase 2+).
 *
 * Research, generation and rendering all run as jobs: a row in the `job` table
 * plus a handler keyed by `kind`. The queue backend (Postgres SKIP LOCKED,
 * Inngest, Trigger.dev…) is swappable behind this interface.
 */

export interface EnqueueInput {
  organizationId: string;
  kind: JobKind;
  provider: string;
  input: Record<string, unknown>;
  projectId?: string;
  campaignId?: string;
  createdById?: string;
}

export interface JobQueue {
  enqueue(input: EnqueueInput): Promise<Job>;
  cancel(jobId: string, organizationId: string): Promise<void>;
}

export interface JobHandlerContext {
  job: Job;
  reportProgress(progress: number): Promise<void>;
  signal: AbortSignal;
}

export type JobHandler = (ctx: JobHandlerContext) => Promise<Record<string, unknown>>;

/** Filled in as each pipeline stage is built. Empty in Phase 1. */
export const jobHandlers: Partial<Record<JobKind, JobHandler>> = {};
