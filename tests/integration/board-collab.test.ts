import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "@/server/auth";
import { createDb, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { applyOps, blankScene, DEFAULT_STYLE, type BoardDoc, type BoardOp } from "@/lib/board";
import type { WorkspaceContext } from "@/server/services/context";
import { addComment, applyBoardOps, deleteComment, getBoardState, listComments, listPresence, opsSince, replaceBoard, resolveThread, touchPresence } from "@/server/services/board";
import { createProject } from "@/server/services/projects";
import { createWorkspace, findMembership } from "@/server/services/workspaces";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("board live collaboration (postgres)", () => {
  let db: Database;
  let ctx: WorkspaceContext;
  let other: WorkspaceContext;
  let projectId: string;

  beforeAll(async () => {
    db = createDb(url!);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(url!);
    const auth = createAuth({ db, secret: "test-secret-".padEnd(40, "x"), baseURL: "http://localhost:3000" });
    const { user } = await auth.api.signUpEmail({ body: { name: "Ada Park", email: "ada@board.test", password: "correct-horse-1" } });
    const { user: u2 } = await auth.api.signUpEmail({ body: { name: "Bo Lind", email: "bo@board.test", password: "correct-horse-1" } });
    const ws = await createWorkspace(auth, db, user.id, { name: "Board Lab" });
    const m = (await findMembership(db, user.id, ws.slug))!;
    ctx = { db, userId: user.id, organization: m.organization, role: m.role };
    // Second editor in the same workspace.
    await db.execute(sql`insert into member (id, organization_id, user_id, role, created_at) values (${crypto.randomUUID()}, ${m.organization.id}, ${u2.id}, 'designer', now())`);
    other = { db, userId: u2.id, organization: m.organization, role: "designer" };
    projectId = (await createProject(ctx, { name: "Launch reel" })).id;
  });
  afterAll(async () => db?.$client.end());

  const frame = (id: string, x: number, text: string) => ({ id, x, y: 0, scene: blankScene(DEFAULT_STYLE, text) });

  it("applies ops in order, versions them, and compiles the video", async () => {
    const start = await getBoardState(ctx, projectId);
    expect(start.version).toBe(0);
    await applyBoardOps(ctx, projectId, "client-a", [
      { t: "frame", frame: frame("a", 0, "Hello") },
      { t: "frame", frame: frame("b", 400, "World") },
    ]);
    await applyBoardOps(other, projectId, "client-b", [{ t: "link", link: { id: "l1", from: "a", to: "b", transition: null } }]);
    const { version, project } = await getBoardState(ctx, projectId);
    expect(version).toBe(2);
    expect(project.spec?.scenes.map((s) => s.elements[0]!.text)).toEqual(["Hello", "World"]);
  });

  it("lets two clients converge on the same board, last write per entity wins", async () => {
    // Both start from version 2 and edit the same frame at once.
    let a: BoardDoc = (await getBoardState(ctx, projectId)).board;
    let b: BoardDoc = a;
    const aOp: BoardOp = { t: "frame", frame: { ...a.frames[0]!, x: 111 } };
    const bOp: BoardOp = { t: "frame", frame: { ...b.frames[0]!, x: 222 } };
    await applyBoardOps(ctx, projectId, "client-a", [aOp]);
    await applyBoardOps(other, projectId, "client-b", [bOp]);
    // Each client rebuilds from server order (own ops included).
    for (const side of ["a", "b"] as const) {
      const log = await opsSince(ctx, projectId, 2);
      const next = applyOps(side === "a" ? a : b, log.ops.flatMap((r) => r.ops));
      if (side === "a") a = next;
      else b = next;
    }
    expect(a).toEqual(b);
    expect(a.frames[0]!.x).toBe(222);
    expect(a).toEqual((await getBoardState(ctx, projectId)).board);
  });

  it("refuses edits from viewers and resets from clients", async () => {
    await expect(applyBoardOps({ ...other, role: "viewer" }, projectId, "v", [{ t: "frame-", id: "a" }])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(applyBoardOps(ctx, projectId, "c", [{ t: "reset", board: (await getBoardState(ctx, projectId)).board }])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("tells far-behind clients to reload after a board replacement", async () => {
    const { board } = await getBoardState(ctx, projectId);
    await replaceBoard(ctx, projectId, { ...board, frames: [frame("z", 0, "Fresh")], links: [] });
    const log = await opsSince(ctx, projectId, 0);
    const rebuilt = applyOps(board, log.ops.flatMap((r) => r.ops));
    expect(rebuilt.frames.map((f) => f.id)).toEqual(["z"]);
  });

  it("converts an older project once, so every collaborator gets the same frame ids", async () => {
    const legacy = (await createProject(ctx, { name: "Legacy reel" })).id;
    const spec = { version: 1, title: "Old", aspect: "9:16", fps: 30, style: DEFAULT_STYLE, scenes: [{ id: "scene_01", purpose: "hook", duration: 2, background: { color: "#000000", preset: null }, elements: [], transition: null }, { id: "scene_02", purpose: "cta", duration: 2, background: { color: "#000000", preset: null }, elements: [], transition: null }] };
    await db.execute(sql`update project set spec = ${JSON.stringify(spec)}::jsonb, board = null where id = ${legacy}`);
    const [a, b] = await Promise.all([getBoardState(ctx, legacy), getBoardState(other, legacy)]);
    expect(a.board.frames.map((f) => f.id)).toEqual(b.board.frames.map((f) => f.id));
    expect((await getBoardState(ctx, legacy)).board.frames.map((f) => f.id)).toEqual(a.board.frames.map((f) => f.id));
    expect(a.board.links).toHaveLength(1);
  });

  it("tracks who is here", async () => {
    await touchPresence(ctx, projectId, { clientId: "client-a", name: "Ada Park", cursor: { x: 10, y: 20 }, selection: "z" });
    await touchPresence(other, projectId, { clientId: "client-b", name: "Bo Lind", cursor: null, selection: null });
    const seenByA = await listPresence(ctx, projectId, "client-a");
    expect(seenByA.map((p) => p.name)).toEqual(["Bo Lind"]);
    expect((await listPresence(other, projectId, "client-b"))[0]).toMatchObject({ name: "Ada Park", cursor: { x: 10, y: 20 }, selection: "z" });
  });

  it("threads comments with replies, resolve, and deletion that syncs", async () => {
    const since = new Date(Date.now() - 1000);
    const root = await addComment(ctx, projectId, { body: "Hook is too slow", frameId: "z", x: 20, y: 40 });
    const reply = await addComment(other, projectId, { body: "Trimmed it", threadId: root.id });
    expect(reply).toMatchObject({ threadId: root.id, frameId: "z", authorName: "Bo Lind" });
    await resolveThread(other, projectId, root.id, true);
    expect((await listComments(ctx, projectId)).find((c) => c.id === root.id)?.resolved).toBe(true);
    await expect(deleteComment(other, projectId, root.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteComment(ctx, projectId, root.id);
    expect(await listComments(ctx, projectId)).toHaveLength(0);
    const changes = await listComments(ctx, projectId, since);
    expect(changes.every((c) => c.deleted)).toBe(true);
  });
});
