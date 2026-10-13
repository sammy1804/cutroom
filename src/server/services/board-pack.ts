import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { asset, project as projectTable, reference } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { getProvider } from "@/server/providers/registry";
import { boardSchema, type BoardDoc, type LooseItem } from "@/lib/board";
import { storageUrl } from "@/lib/drag";
import type { AssetRights, CreativeDirection, ReferenceAnalysis } from "@/lib/creative-types";
import { getBoardState, replaceBoard } from "./board";
import { assertCan, type WorkspaceContext } from "./context";
import { createProject } from "./projects";

/**
 * Board packs: a project's board with its files, references and rights in one
 * JSON file, so a board can move between workspaces (local → production, one
 * client's workspace to another) without anything living in the code.
 * Files used by the board travel as base64; rights records travel with them.
 */

export const PACK_FORMAT = "cutroom.board-pack";
const MAX_FILE = 2_500_000;
const MAX_PACK_FILES = 2_400_000;
const PACK_REF = "pack:";

const packSchema = z.object({
  format: z.literal(PACK_FORMAT),
  version: z.literal(1),
  project: z.object({
    name: z.string().min(1).max(80),
    description: z.string().max(500).nullable(),
    websiteUrl: z.string().max(300).nullable(),
    idea: z.string().max(3000).nullable(),
    audience: z.string().max(1000).nullable(),
    format: z.string().max(10),
    chosenDirection: z.record(z.string(), z.unknown()).nullable(),
  }),
  board: boardSchema,
  assets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(200),
        kind: z.enum(["image", "animation"]),
        mimeType: z.string().max(100),
        ext: z.string().max(8),
        thumbnailUrl: z.string().nullable(),
        rights: z.record(z.string(), z.unknown()).nullable(),
        tags: z.array(z.string()).max(30),
        metadata: z.record(z.string(), z.unknown()),
        data: z.string(),
      }),
    )
    .max(60),
  references: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(300),
        url: z.string().max(1000),
        tags: z.array(z.string()).max(30),
        analysis: z.record(z.string(), z.unknown()).nullable(),
        data: z.string().nullable(),
      }),
    )
    .max(60),
});
export type BoardPack = z.infer<typeof packSchema>;

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** Everything the board uses, bundled. Unused project assets are left out to keep packs small. */
export async function exportBoardPack(ctx: WorkspaceContext, projectId: string): Promise<BoardPack> {
  const { board, project } = await getBoardState(ctx, projectId);
  const storage = getProvider("storage");

  const assetIds = new Set(board.frames.flatMap((f) => f.scene.elements.map((e) => e.assetId).filter((x): x is string => Boolean(x))));
  // The project's other approved images and animations travel too, so the library panel isn't empty after import.
  const extra = await ctx.db
    .select({ id: asset.id })
    .from(asset)
    .where(and(eq(asset.organizationId, ctx.organization.id), eq(asset.projectId, projectId), inArray(asset.kind, ["image", "animation"]), inArray(asset.usageStatus, ["approved", "in_use"])));
  for (const e of extra) assetIds.add(e.id);
  const refIds = new Set(board.items.flatMap((i) => (i.kind === "reference" ? [i.referenceId] : [])));
  const assets = assetIds.size ? await ctx.db.select().from(asset).where(and(eq(asset.organizationId, ctx.organization.id), inArray(asset.id, [...assetIds]))) : [];
  const refs = refIds.size ? await ctx.db.select().from(reference).where(and(eq(reference.organizationId, ctx.organization.id), inArray(reference.id, [...refIds]))) : [];

  const packedAssets: BoardPack["assets"] = [];
  let total = 0;
  for (const a of assets) {
    const body = a.storageKey ? await storage.get(a.storageKey) : null;
    if (!body || body.byteLength > MAX_FILE) continue;
    // Stay well under the 4.5 MB upload limit (base64 adds a third).
    if (total + body.byteLength > MAX_PACK_FILES) continue;
    total += body.byteLength;
    packedAssets.push({
      id: a.id,
      name: a.name,
      kind: a.kind === "animation" ? "animation" : "image",
      mimeType: a.mimeType ?? "application/octet-stream",
      ext: a.storageKey!.split(".").pop() ?? "bin",
      thumbnailUrl: a.thumbnailUrl,
      rights: (a.rights as Record<string, unknown> | null) ?? null,
      tags: a.tags,
      metadata: a.metadata,
      data: b64(body),
    });
  }
  const packedRefs: BoardPack["references"] = [];
  for (const r of refs) {
    const body = r.imageKey ? await storage.get(r.imageKey) : null;
    packedRefs.push({ id: r.id, title: r.title, url: r.url, tags: r.tags, analysis: (r.analysis as Record<string, unknown> | null) ?? null, data: body && body.byteLength <= MAX_FILE ? b64(body) : null });
  }

  // Point the board at pack ids instead of this workspace's storage URLs.
  const portable: BoardDoc = {
    ...board,
    frames: board.frames.map((f) => ({ ...f, scene: { ...f.scene, elements: f.scene.elements.map((e) => (e.assetId ? { ...e, src: `${PACK_REF}${e.assetId}` } : e)) } })),
    items: board.items.map((i) => (i.kind === "reference" ? { ...i, imageUrl: `${PACK_REF}${i.referenceId}` } : i)),
  };

  return {
    format: PACK_FORMAT,
    version: 1,
    project: {
      name: project.name,
      description: project.description,
      websiteUrl: project.websiteUrl,
      idea: project.idea,
      audience: project.audience,
      format: project.format,
      chosenDirection: (project.chosenDirection as Record<string, unknown> | null) ?? null,
    },
    board: portable,
    assets: packedAssets,
    references: packedRefs,
  };
}

/** Creates a new project from a pack in this workspace: files stored, ids remapped, rights kept. */
export async function importBoardPack(ctx: WorkspaceContext, raw: unknown) {
  assertCan(ctx, { project: ["create"] });
  const parsed = packSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("VALIDATION", "That file isn't a Cutroom board pack.");
  const pack = parsed.data;
  const storage = getProvider("storage");

  const created = await createProject(ctx, { name: pack.project.name, description: pack.project.description ?? undefined, websiteUrl: pack.project.websiteUrl ?? undefined });
  const direction = pack.project.chosenDirection as CreativeDirection | null;
  await ctx.db
    .update(projectTable)
    .set({ idea: pack.project.idea, audience: pack.project.audience, format: pack.project.format, chosenDirection: direction, directions: direction ? [direction] : [], stage: "story" })
    .where(eq(projectTable.id, created.id));

  const assetMap = new Map<string, { id: string; url: string }>();
  for (const a of pack.assets) {
    const body = new Uint8Array(Buffer.from(a.data, "base64"));
    if (body.byteLength > MAX_FILE) continue;
    const id = crypto.randomUUID();
    const key = `${ctx.organization.id}/assets/${id}.${a.ext.replace(/[^a-z0-9]/gi, "")}`;
    await storage.put({ key, body, contentType: a.mimeType });
    await ctx.db.insert(asset).values({
      id,
      organizationId: ctx.organization.id,
      projectId: created.id,
      kind: a.kind,
      source: "imported",
      usageStatus: "approved",
      name: a.name,
      storageProvider: "local",
      storageKey: key,
      thumbnailUrl: a.thumbnailUrl,
      mimeType: a.mimeType,
      sizeBytes: body.byteLength,
      rights: a.rights as AssetRights | null,
      tags: a.tags,
      metadata: { ...a.metadata, importedFromPack: true },
      createdById: ctx.userId,
    });
    assetMap.set(a.id, { id, url: storageUrl(key)! });
  }

  const refMap = new Map<string, { id: string; url: string | null }>();
  for (const r of pack.references) {
    const id = crypto.randomUUID();
    let key: string | null = null;
    if (r.data) {
      key = `${ctx.organization.id}/references/${id}.jpg`;
      await storage.put({ key, body: new Uint8Array(Buffer.from(r.data, "base64")), contentType: "image/jpeg" });
    }
    await ctx.db.insert(reference).values({
      id,
      organizationId: ctx.organization.id,
      projectId: created.id,
      url: r.url,
      title: r.title,
      imageKey: key,
      tags: r.tags,
      rank: 80,
      status: "approved",
      analysis: r.analysis as ReferenceAnalysis | null,
      createdById: ctx.userId,
    });
    refMap.set(r.id, { id, url: storageUrl(key) });
  }

  const board: BoardDoc = {
    ...pack.board,
    frames: pack.board.frames.map((f) => ({
      ...f,
      scene: {
        ...f.scene,
        // Elements whose file didn't travel are dropped rather than left pointing nowhere.
        elements: f.scene.elements.flatMap((e) => {
          if (!e.assetId) return [e];
          const m = assetMap.get(e.assetId);
          return m ? [{ ...e, assetId: m.id, src: m.url }] : [];
        }),
      },
    })),
    items: pack.board.items.flatMap((i): LooseItem[] => {
      if (i.kind !== "reference") return [i];
      const m = refMap.get(i.referenceId);
      return m ? [{ ...i, referenceId: m.id, imageUrl: m.url }] : [];
    }),
  };
  await replaceBoard(ctx, created.id, board);
  return { projectId: created.id, assets: assetMap.size, references: refMap.size };
}
