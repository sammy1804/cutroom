import { and, desc, eq } from "drizzle-orm";
import { brainThread } from "@/server/db/schema";
import { notFound } from "@/server/errors";
import type { WorkspaceContext } from "./context";

export async function listBrainThreads(ctx: WorkspaceContext) {
  return ctx.db
    .select({ id: brainThread.id, title: brainThread.title, updatedAt: brainThread.updatedAt, projectId: brainThread.projectId })
    .from(brainThread)
    .where(eq(brainThread.organizationId, ctx.organization.id))
    .orderBy(desc(brainThread.updatedAt))
    .limit(30);
}

export async function getBrainThread(ctx: WorkspaceContext, id: string) {
  const [row] = await ctx.db.select().from(brainThread).where(and(eq(brainThread.id, id), eq(brainThread.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Conversation");
  return row;
}
