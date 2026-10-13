import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/server/auth";
import { createDb, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { asset, reference } from "@/server/db/schema";
import { blankScene, DEFAULT_STYLE, LOCAL_SCENE } from "@/lib/board";
import type { WorkspaceContext } from "@/server/services/context";
import { getBoardState, replaceBoard } from "@/server/services/board";
import { exportBoardPack, importBoardPack } from "@/server/services/board-pack";
import { createProject } from "@/server/services/projects";
import { createWorkspace, findMembership } from "@/server/services/workspaces";

const stored = new Map<string, Uint8Array>();
vi.mock("@/server/providers/registry", () => ({
  getProvider: () => ({
    put: async ({ key, body }: { key: string; body: Uint8Array }) => void stored.set(key, body),
    get: async (key: string) => stored.get(key) ?? null,
    delete: async (key: string) => void stored.delete(key),
  }),
}));

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("board packs (postgres)", () => {
  let db: Database;
  let a: WorkspaceContext;
  let b: WorkspaceContext;

  beforeAll(async () => {
    db = createDb(url!);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(url!);
    const auth = createAuth({ db, secret: "test-secret-".padEnd(40, "x"), baseURL: "http://localhost:3000" });
    const { user } = await auth.api.signUpEmail({ body: { name: "Pat Sen", email: "pat@pack.test", password: "correct-horse-1" } });
    const ws1 = await createWorkspace(auth, db, user.id, { name: "Local Studio" });
    const ws2 = await createWorkspace(auth, db, user.id, { name: "Prod Studio" });
    const m1 = (await findMembership(db, user.id, ws1.slug))!;
    const m2 = (await findMembership(db, user.id, ws2.slug))!;
    a = { db, userId: user.id, organization: m1.organization, role: m1.role };
    b = { db, userId: user.id, organization: m2.organization, role: m2.role };
  });
  afterAll(async () => db?.$client.end());

  it("moves a board with its files, references and rights into another workspace", async () => {
    const p = await createProject(a, { name: "Speedrun draft" });
    const fileKey = `${a.organization.id}/assets/x.webp`;
    stored.set(fileKey, new Uint8Array([1, 2, 3]));
    const [img] = await db
      .insert(asset)
      .values({ organizationId: a.organization.id, projectId: p.id, kind: "image", source: "imported", name: "Photo", storageKey: fileKey, mimeType: "image/webp", rights: { source: "Client", sourceUrl: "x", creator: null, license: "Client-provided", licenseUrl: null, attributionRequired: false, commercialUse: true, modificationAllowed: true, collectedAt: "2026-10-14" } })
      .returning();
    const refKey = `${a.organization.id}/references/r.jpg`;
    stored.set(refKey, new Uint8Array([9, 9]));
    const [ref] = await db.insert(reference).values({ organizationId: a.organization.id, projectId: p.id, url: "https://example.com", title: "Vox pop", imageKey: refKey, status: "approved" }).returning();
    const scene = blankScene(DEFAULT_STYLE, "Hello");
    scene.elements.push({ id: `${LOCAL_SCENE}.image`, type: "image", assetId: img!.id, src: "/api/assets/old", layout: "fullbleed", animation: null });
    await replaceBoard(a, p.id, {
      version: 2,
      title: "T",
      aspect: "9:16",
      style: DEFAULT_STYLE,
      frames: [{ id: "f1", x: 0, y: 0, scene }],
      links: [],
      items: [{ id: "i1", kind: "reference", x: 0, y: -300, w: 280, h: 220, referenceId: ref!.id, title: "Vox pop", imageUrl: "/api/assets/old-ref", url: "https://example.com" }],
    });

    const pack = JSON.parse(JSON.stringify(await exportBoardPack(a, p.id)));
    expect(pack.assets).toHaveLength(1);
    expect(pack.board.frames[0].scene.elements[1].src).toBe(`pack:${img!.id}`);

    const { projectId } = await importBoardPack(b, pack);
    const { board } = await getBoardState(b, projectId);
    const el = board.frames[0]!.scene.elements[1]!;
    expect(el.assetId).not.toBe(img!.id);
    expect(el.src).toContain(b.organization.id);
    const [copy] = await db.select().from(asset).where(eq(asset.id, el.assetId!));
    expect(copy).toMatchObject({ organizationId: b.organization.id, projectId, rights: expect.objectContaining({ license: "Client-provided" }) });
    expect(stored.get(copy!.storageKey!)).toEqual(new Uint8Array([1, 2, 3]));
    const item = board.items[0]!;
    expect(item.kind === "reference" && item.imageUrl).toContain(b.organization.id);
  });

  it("rejects files that aren't packs", async () => {
    await expect(importBoardPack(b, { hello: "world" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
