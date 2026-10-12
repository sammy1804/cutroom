"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { brainThread, project as projectTable } from "@/server/db/schema";
import { AppError, runAction } from "@/server/errors";
import { actionWorkspace } from "@/server/session";
import { assertCan, type WorkspaceContext } from "@/server/services/context";
import { createProject } from "@/server/services/projects";
import { runSkill } from "@/server/skills/runtime";
import type { BrainTurn, CreativeDirection } from "@/lib/creative-types";
import type { BrainReply } from "@/lib/skill-types";

type Action = NonNullable<BrainTurn["action"]>;
const LABEL: Record<Action, string> = {
  brainstorm: "Brainstorm",
  why: "Why?",
  another: "Give me another direction",
  research: "Research this",
  stronger: "Make this stronger",
  different: "Try something completely different",
  references: "Find references",
};

async function getThread(ctx: WorkspaceContext, id: string) {
  const [row] = await ctx.db.select().from(brainThread).where(and(eq(brainThread.id, id), eq(brainThread.organizationId, ctx.organization.id)));
  if (!row) throw new AppError("NOT_FOUND", "Conversation not found.");
  return row;
}

function brainTurn(reply: BrainReply, action: Action): BrainTurn {
  return { id: crypto.randomUUID(), role: "brain", action, text: reply.reply, directions: reply.directions, insights: reply.insights, questions: reply.questions, at: new Date().toISOString() };
}

const allDirections = (turns: BrainTurn[]) => turns.flatMap((t) => t.directions ?? []);

export async function startBrainAction(slug: string, idea: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const text = z.string().trim().min(8, "Tell me a little more about the idea.").max(3000).parse(idea);
    const [thread] = await ctx.db
      .insert(brainThread)
      .values({ organizationId: ctx.organization.id, title: text.slice(0, 80), createdById: ctx.userId, turns: [{ id: crypto.randomUUID(), role: "user", action: "brainstorm", text, at: new Date().toISOString() }] })
      .returning();
    const { output } = await runSkill<BrainReply>(ctx, "creative.brainstorm", { idea: text, action: "brainstorm" }, { reason: "Brain: first directions" });
    await ctx.db.update(brainThread).set({ turns: [...thread!.turns, brainTurn(output, "brainstorm")] }).where(eq(brainThread.id, thread!.id));
    revalidatePath(`/w/${slug}/brain`, "layout");
    return { threadId: thread!.id };
  });
}

export async function brainFollowUpAction(slug: string, threadId: string, action: Action, directionId?: string, message?: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const thread = await getThread(ctx, threadId);
    const idea = thread.turns[0]?.text ?? thread.title;
    const focus = directionId ? allDirections(thread.turns).find((d) => d.id === directionId) : undefined;
    const userText = message?.trim() || `${LABEL[action]}${focus ? `: ${focus.title}` : ""}`;
    const userTurn: BrainTurn = { id: crypto.randomUUID(), role: "user", action, text: userText, at: new Date().toISOString() };
    const { output } = await runSkill<BrainReply>(
      ctx,
      "creative.brainstorm",
      {
        idea,
        action,
        message: message?.trim() || undefined,
        focus,
        history: thread.turns.slice(-12).map((t) => ({ role: t.role, text: t.text })),
        previousTitles: allDirections(thread.turns).map((d) => d.title),
      },
      { reason: `Brain: ${LABEL[action]}` },
    );
    // Direction ids must stay unique across the whole thread.
    const taken = new Set(allDirections(thread.turns).map((d) => d.id));
    output.directions = output.directions.map((d) => {
      let id = d.id.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "direction";
      while (taken.has(id)) id = `${id}-2`;
      taken.add(id);
      return { ...d, id };
    });
    await ctx.db.update(brainThread).set({ turns: [...thread.turns, userTurn, brainTurn(output, action)] }).where(eq(brainThread.id, threadId));
    revalidatePath(`/w/${slug}/brain/${threadId}`);
  });
}

export async function projectFromDirectionAction(slug: string, threadId: string, directionId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { project: ["create"] });
    const thread = await getThread(ctx, threadId);
    const directions: CreativeDirection[] = allDirections(thread.turns);
    const chosen = directions.find((d) => d.id === directionId);
    if (!chosen) throw new AppError("NOT_FOUND", "That direction is no longer in this conversation.");
    const created = await createProject(ctx, { name: chosen.title, description: chosen.premise });
    await ctx.db
      .update(projectTable)
      .set({ idea: thread.turns[0]?.text ?? chosen.premise, directions: directions.slice(-6), chosenDirection: chosen, stage: "story" })
      .where(eq(projectTable.id, created.id));
    await ctx.db.update(brainThread).set({ projectId: created.id }).where(eq(brainThread.id, threadId));
    revalidatePath(`/w/${slug}`, "layout");
    return { projectId: created.id };
  });
}
