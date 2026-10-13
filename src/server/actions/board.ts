"use server";

import { z } from "zod";
import { runAction } from "@/server/errors";
import { actionWorkspace } from "@/server/session";
import { addComment, deleteComment, moveThread, resolveThread } from "@/server/services/board";

const commentInput = z.object({
  body: z.string().trim().min(1, "Write something first.").max(2000),
  threadId: z.string().nullable().optional(),
  frameId: z.string().max(40).nullable().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

/** Anyone in the workspace can comment, including viewers: feedback shouldn't need edit rights. */
export async function addCommentAction(slug: string, projectId: string, input: z.input<typeof commentInput>) {
  return runAction(async () => addComment(await actionWorkspace(slug), projectId, commentInput.parse(input)));
}

export async function resolveCommentAction(slug: string, projectId: string, id: string, resolved: boolean) {
  return runAction(async () => resolveThread(await actionWorkspace(slug), projectId, id, resolved));
}

export async function moveCommentAction(slug: string, projectId: string, id: string, at: { x: number; y: number; frameId: string | null }) {
  return runAction(async () => moveThread(await actionWorkspace(slug), projectId, id, at));
}

export async function deleteCommentAction(slug: string, projectId: string, id: string) {
  return runAction(async () => deleteComment(await actionWorkspace(slug), projectId, id));
}
