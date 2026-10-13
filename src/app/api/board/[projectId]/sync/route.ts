import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { boardOpSchema } from "@/lib/board";
import { toActionError } from "@/server/errors";
import { actionWorkspace, getSession } from "@/server/session";
import { applyBoardOps, leaveBoard, listComments, listPresence, opsSince, touchPresence } from "@/server/services/board";

const body = z.object({
  slug: z.string().min(1),
  clientId: z.string().min(6).max(64),
  since: z.number().int().min(0),
  ops: z.array(boardOpSchema).max(200).default([]),
  cursor: z.object({ x: z.number(), y: z.number() }).nullable().default(null),
  selection: z.string().max(60).nullable().default(null),
  commentsSince: z.string().datetime().nullable().default(null),
  leaving: z.boolean().default(false),
});

/**
 * One round trip of live collaboration: send local ops and presence, get back
 * every op after `since` (in server order), who else is here, and comments
 * that changed. Clients call it about once a second while the board is open.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const input = body.parse(await request.json());
    const ctx = await actionWorkspace(input.slug);
    if (input.leaving) {
      await leaveBoard(ctx, projectId, input.clientId);
      return NextResponse.json({ ok: true });
    }
    const now = new Date();
    if (input.ops.length) await applyBoardOps(ctx, projectId, input.clientId, input.ops);
    const session = await getSession();
    const [log, , comments] = await Promise.all([
      opsSince(ctx, projectId, input.since),
      touchPresence(ctx, projectId, { clientId: input.clientId, name: session?.user.name ?? "Someone", cursor: input.cursor, selection: input.selection }),
      input.commentsSince ? listComments(ctx, projectId, new Date(input.commentsSince)) : Promise.resolve([]),
    ]);
    const presence = await listPresence(ctx, projectId, input.clientId);
    return NextResponse.json({ ok: true, version: log.version, ops: log.ops, presence, comments, now: now.toISOString() });
  } catch (error) {
    const res = toActionError(error);
    return NextResponse.json(res, { status: res.code === "UNAUTHENTICATED" ? 401 : res.code === "NOT_FOUND" ? 404 : res.code === "FORBIDDEN" ? 403 : res.code === "VALIDATION" ? 400 : 500 });
  }
}
