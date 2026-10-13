import { and, asc, desc, eq, gt, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { boardComment, boardOp, boardPresence, project as projectTable, user } from "@/server/db/schema";
import { AppError, notFound } from "@/server/errors";
import { applyOps, boardSchema, compileSpec, loadBoard, type BoardDoc, type BoardOp } from "@/lib/board";
import { assertCan, type WorkspaceContext } from "./context";

/**
 * Board persistence and live collaboration. Every change is a small operation
 * applied under a row lock and appended to an op log with a version number;
 * collaborators poll for ops after the version they have. The project's
 * CreativeSpec is recompiled from the board's main chain on every change.
 */

type Tx = Parameters<Parameters<WorkspaceContext["db"]["transaction"]>[0]>[0];

async function lockedProject(tx: Tx, ctx: WorkspaceContext, projectId: string) {
  const [row] = await tx
    .select()
    .from(projectTable)
    .where(and(eq(projectTable.id, projectId), eq(projectTable.organizationId, ctx.organization.id)))
    .for("update");
  if (!row) throw notFound("Project");
  return row;
}

export async function getBoardState(ctx: WorkspaceContext, projectId: string) {
  const [row] = await ctx.db
    .select()
    .from(projectTable)
    .where(and(eq(projectTable.id, projectId), eq(projectTable.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Project");
  const stored = boardSchema.safeParse(row.board);
  if (stored.success) return { board: stored.data, version: row.boardVersion, project: row };
  // Older or missing boards are converted once and saved, so every collaborator shares the same frame ids.
  return ctx.db.transaction(async (tx) => {
    const locked = await lockedProject(tx, ctx, projectId);
    const again = boardSchema.safeParse(locked.board);
    if (again.success) return { board: again.data, version: locked.boardVersion, project: locked };
    const board = loadBoard(locked.board, locked.spec, { title: locked.name, aspect: locked.format });
    await tx.update(projectTable).set({ board }).where(eq(projectTable.id, projectId));
    return { board, version: locked.boardVersion, project: { ...locked, board } };
  });
}

/** Applies a client's ops. Returns the new version. */
export async function applyBoardOps(ctx: WorkspaceContext, projectId: string, clientId: string, ops: BoardOp[]) {
  assertCan(ctx, { project: ["update"] });
  if (ops.some((o) => o.t === "reset")) throw new AppError("VALIDATION", "Clients can't reset the board.");
  return writeOps(ctx, projectId, clientId, ops);
}

/** Replaces the whole board (AI drafts, templates). Collaborators reload. */
export async function replaceBoard(ctx: WorkspaceContext, projectId: string, board: BoardDoc) {
  return writeOps(ctx, projectId, "server", [{ t: "reset", board: boardSchema.parse(board) }]);
}

async function writeOps(ctx: WorkspaceContext, projectId: string, clientId: string, ops: BoardOp[]) {
  if (!ops.length) return null;
  return ctx.db.transaction(async (tx) => {
    const row = await lockedProject(tx, ctx, projectId);
    const before = loadBoard(row.board, row.spec, { title: row.name, aspect: row.format });
    const board = boardSchema.parse(applyOps(before, ops));
    const version = row.boardVersion + 1;
    await tx
      .update(projectTable)
      .set({ board, boardVersion: version, spec: compileSpec(board) ?? row.spec, updatedAt: new Date() })
      .where(eq(projectTable.id, projectId));
    await tx.insert(boardOp).values({ projectId, version, clientId, userId: ctx.userId, ops });
    if (version % 100 === 0) await tx.delete(boardOp).where(and(eq(boardOp.projectId, projectId), lt(boardOp.createdAt, new Date(Date.now() - 86_400_000))));
    return { version, board };
  });
}

/** Ops after `since`, or a full reset when the log no longer reaches back that far. */
export async function opsSince(ctx: WorkspaceContext, projectId: string, since: number) {
  const { board, version } = await getBoardState(ctx, projectId);
  if (since >= version) return { version, ops: [] as { version: number; clientId: string; ops: BoardOp[] }[] };
  const rows = await ctx.db
    .select({ version: boardOp.version, clientId: boardOp.clientId, ops: boardOp.ops })
    .from(boardOp)
    .where(and(eq(boardOp.projectId, projectId), gt(boardOp.version, since)))
    .orderBy(asc(boardOp.version))
    .limit(500);
  const contiguous = rows.length > 0 && rows[0]!.version === since + 1 && rows[rows.length - 1]!.version === version;
  if (!contiguous) return { version, ops: [{ version, clientId: "server", ops: [{ t: "reset", board } as BoardOp] }] };
  return { version, ops: rows };
}

/* ─── Presence ─────────────────────────────────────────────────────────── */

const PALETTE = ["#e5484d", "#0090ff", "#30a46c", "#f76b15", "#8e4ec6", "#d6409f", "#12a594", "#ffb224"];
const colorFor = (userId: string) => PALETTE[[...userId].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length]!;

export async function touchPresence(ctx: WorkspaceContext, projectId: string, input: { clientId: string; name: string; cursor: { x: number; y: number } | null; selection: string | null }) {
  const values = { projectId, clientId: input.clientId, userId: ctx.userId, name: input.name, color: colorFor(ctx.userId), cursor: input.cursor, selection: input.selection, updatedAt: new Date() };
  await ctx.db
    .insert(boardPresence)
    .values(values)
    .onConflictDoUpdate({ target: [boardPresence.projectId, boardPresence.clientId], set: { cursor: values.cursor, selection: values.selection, name: values.name, updatedAt: values.updatedAt } });
}

export async function listPresence(ctx: WorkspaceContext, projectId: string, exceptClient: string) {
  return ctx.db
    .select({ clientId: boardPresence.clientId, userId: boardPresence.userId, name: boardPresence.name, color: boardPresence.color, cursor: boardPresence.cursor, selection: boardPresence.selection })
    .from(boardPresence)
    .where(and(eq(boardPresence.projectId, projectId), ne(boardPresence.clientId, exceptClient), gte(boardPresence.updatedAt, new Date(Date.now() - 15_000))));
}

export async function leaveBoard(ctx: WorkspaceContext, projectId: string, clientId: string) {
  await ctx.db.delete(boardPresence).where(and(eq(boardPresence.projectId, projectId), eq(boardPresence.clientId, clientId), eq(boardPresence.userId, ctx.userId)));
}

/* ─── Comments ─────────────────────────────────────────────────────────── */

export interface CommentView {
  id: string;
  threadId: string | null;
  frameId: string | null;
  x: number;
  y: number;
  body: string;
  authorId: string | null;
  authorName: string;
  resolved: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

const commentFields = {
  id: boardComment.id,
  threadId: boardComment.threadId,
  frameId: boardComment.frameId,
  x: boardComment.x,
  y: boardComment.y,
  body: boardComment.body,
  authorId: boardComment.authorId,
  authorName: sql<string>`coalesce(${user.name}, 'Someone')`,
  resolvedAt: boardComment.resolvedAt,
  deletedAt: boardComment.deletedAt,
  createdAt: boardComment.createdAt,
  updatedAt: boardComment.updatedAt,
};

function view(r: { id: string; threadId: string | null; frameId: string | null; x: number; y: number; body: string; authorId: string | null; authorName: string; resolvedAt: Date | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date }): CommentView {
  return {
    id: r.id,
    threadId: r.threadId,
    frameId: r.frameId,
    x: r.x,
    y: r.y,
    body: r.deletedAt ? "" : r.body,
    authorId: r.authorId,
    authorName: r.authorName,
    resolved: Boolean(r.resolvedAt),
    deleted: Boolean(r.deletedAt),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** All live comments, or everything changed since a time (including deletions) for sync. */
export async function listComments(ctx: WorkspaceContext, projectId: string, since?: Date) {
  const conds = [eq(boardComment.projectId, projectId), eq(boardComment.organizationId, ctx.organization.id)];
  if (since) conds.push(gt(boardComment.updatedAt, since));
  else conds.push(isNull(boardComment.deletedAt));
  const rows = await ctx.db.select(commentFields).from(boardComment).leftJoin(user, eq(user.id, boardComment.authorId)).where(and(...conds)).orderBy(asc(boardComment.createdAt)).limit(500);
  return rows.map(view);
}

export async function addComment(ctx: WorkspaceContext, projectId: string, input: { body: string; threadId?: string | null; frameId?: string | null; x?: number; y?: number }) {
  const body = input.body.trim().slice(0, 2000);
  if (!body) throw new AppError("VALIDATION", "Write something first.");
  const [p] = await ctx.db.select({ id: projectTable.id }).from(projectTable).where(and(eq(projectTable.id, projectId), eq(projectTable.organizationId, ctx.organization.id)));
  if (!p) throw notFound("Project");
  let anchor = { frameId: input.frameId ?? null, x: input.x ?? 0, y: input.y ?? 0 };
  if (input.threadId) {
    const [thread] = await ctx.db.select().from(boardComment).where(and(eq(boardComment.id, input.threadId), eq(boardComment.projectId, projectId)));
    if (!thread || thread.threadId) throw notFound("Thread");
    anchor = { frameId: thread.frameId, x: thread.x, y: thread.y };
    // A reply re-opens the thread and bumps it so everyone syncs.
    await ctx.db.update(boardComment).set({ resolvedAt: null, updatedAt: new Date() }).where(eq(boardComment.id, thread.id));
  }
  const [row] = await ctx.db
    .insert(boardComment)
    .values({ organizationId: ctx.organization.id, projectId, threadId: input.threadId ?? null, ...anchor, body, authorId: ctx.userId })
    .returning();
  return (await listComments(ctx, projectId)).find((c) => c.id === row!.id)!;
}

async function ownThread(ctx: WorkspaceContext, projectId: string, id: string) {
  const [row] = await ctx.db.select().from(boardComment).where(and(eq(boardComment.id, id), eq(boardComment.projectId, projectId), eq(boardComment.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Comment");
  return row;
}

export async function resolveThread(ctx: WorkspaceContext, projectId: string, id: string, resolved: boolean) {
  const row = await ownThread(ctx, projectId, id);
  await ctx.db.update(boardComment).set({ resolvedAt: resolved ? new Date() : null, updatedAt: new Date() }).where(eq(boardComment.id, row.threadId ?? row.id));
}

export async function moveThread(ctx: WorkspaceContext, projectId: string, id: string, at: { x: number; y: number; frameId: string | null }) {
  const row = await ownThread(ctx, projectId, id);
  await ctx.db.update(boardComment).set({ ...at, updatedAt: new Date() }).where(eq(boardComment.id, row.threadId ?? row.id));
}

/** Authors can delete their own comments; admins and owners can delete any. Deleting a thread deletes its replies. */
export async function deleteComment(ctx: WorkspaceContext, projectId: string, id: string) {
  const row = await ownThread(ctx, projectId, id);
  if (row.authorId !== ctx.userId && ctx.role !== "owner" && ctx.role !== "admin") throw new AppError("FORBIDDEN", "You can only delete your own comments.");
  const now = new Date();
  await ctx.db.update(boardComment).set({ deletedAt: now, updatedAt: now }).where(eq(boardComment.id, id));
  if (!row.threadId) await ctx.db.update(boardComment).set({ deletedAt: now, updatedAt: now }).where(eq(boardComment.threadId, id));
}

export async function latestCommentTime(ctx: WorkspaceContext, projectId: string) {
  const [r] = await ctx.db.select({ t: boardComment.updatedAt }).from(boardComment).where(eq(boardComment.projectId, projectId)).orderBy(desc(boardComment.updatedAt)).limit(1);
  return r?.t ?? null;
}
