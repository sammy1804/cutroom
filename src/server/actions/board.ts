"use server";

import { and, eq } from "drizzle-orm";
import { project as projectTable } from "@/server/db/schema";
import { runAction } from "@/server/errors";
import { actionWorkspace } from "@/server/session";
import { assertCan } from "@/server/services/context";
import { getProject } from "@/server/services/projects";
import { boardSchema } from "@/lib/board";

/** Autosaves the project board (positions, notes, dropped media). */
export async function saveBoardAction(slug: string, projectId: string, board: unknown) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { project: ["update"] });
    await getProject(ctx, projectId);
    const parsed = boardSchema.parse(board);
    await ctx.db
      .update(projectTable)
      .set({ board: parsed })
      .where(and(eq(projectTable.id, projectId), eq(projectTable.organizationId, ctx.organization.id)));
    return { savedAt: new Date().toISOString() };
  });
}
