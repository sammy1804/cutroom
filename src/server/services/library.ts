import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { animationPreset, asset, campaign, creativeDna, creativeMemory, reference } from "@/server/db/schema";
import { AppError, notFound } from "@/server/errors";
import { getProvider } from "@/server/providers/registry";
import type { AssetCandidate } from "@/server/providers/assets/types";
import { getPreset } from "@/lib/animations/presets";
import { sanitizeParams } from "@/lib/animations/types";
import type { AnimationRole, CreativeSpec } from "@/lib/creative-types";
import { assertCan, type WorkspaceContext } from "./context";

/* ─── Company Creative Library (approved decisions) ─────────────────────── */

type MemoryKind = (typeof creativeMemory.kind.enumValues)[number];

export async function remember(ctx: WorkspaceContext, kind: MemoryKind, subjectId: string, title: string, payload: Record<string, unknown> = {}, note?: string) {
  await ctx.db
    .insert(creativeMemory)
    .values({ organizationId: ctx.organization.id, kind, subjectId, title, note: note ?? null, payload, approvedById: ctx.userId })
    .onConflictDoUpdate({ target: [creativeMemory.organizationId, creativeMemory.kind, creativeMemory.subjectId], set: { title, payload, updatedAt: new Date() } });
}

export async function forget(ctx: WorkspaceContext, kind: MemoryKind, subjectId: string) {
  await ctx.db
    .delete(creativeMemory)
    .where(and(eq(creativeMemory.organizationId, ctx.organization.id), eq(creativeMemory.kind, kind), eq(creativeMemory.subjectId, subjectId)));
}

export async function listMemory(ctx: WorkspaceContext, limit = 200) {
  return ctx.db.select().from(creativeMemory).where(eq(creativeMemory.organizationId, ctx.organization.id)).orderBy(desc(creativeMemory.updatedAt)).limit(limit);
}

/* ─── References ────────────────────────────────────────────────────────── */

export async function listReferences(ctx: WorkspaceContext, opts: { projectId?: string; status?: "pending" | "approved" | "rejected"; search?: string; limit?: number } = {}) {
  const conds = [eq(reference.organizationId, ctx.organization.id)];
  if (opts.projectId) conds.push(eq(reference.projectId, opts.projectId));
  if (opts.status) conds.push(eq(reference.status, opts.status));
  if (opts.search?.trim()) {
    const words = opts.search.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
    if (words.length) {
      conds.push(
        or(
          ...words.flatMap((w) => [
            ilike(reference.title, `%${w}%`),
            sql`exists (select 1 from unnest(${reference.tags}) t where t ilike ${`%${w}%`})`,
            sql`${reference.analysis}::text ilike ${`%${w}%`}`,
          ]),
        )!,
      );
    }
  }
  return ctx.db.select().from(reference).where(and(...conds)).orderBy(desc(reference.rank), desc(reference.createdAt)).limit(opts.limit ?? 120);
}

export async function setReferenceStatus(ctx: WorkspaceContext, id: string, status: "approved" | "rejected" | "pending") {
  assertCan(ctx, { asset: ["upload"] });
  const [row] = await ctx.db
    .update(reference)
    .set({ status })
    .where(and(eq(reference.id, id), eq(reference.organizationId, ctx.organization.id)))
    .returning();
  if (!row) throw notFound("Reference");
  if (status === "approved") await remember(ctx, "reference", row.id, row.title, { url: row.url, learnings: row.analysis?.learnings ?? [], tags: row.tags });
  else await forget(ctx, "reference", row.id);
  return row;
}

export async function deleteReference(ctx: WorkspaceContext, id: string) {
  assertCan(ctx, { asset: ["delete"] });
  const rows = await ctx.db
    .delete(reference)
    .where(and(eq(reference.organizationId, ctx.organization.id), or(eq(reference.id, id), eq(reference.parentId, id))))
    .returning({ id: reference.id, imageKey: reference.imageKey });
  if (!rows.length) throw notFound("Reference");
  const storage = getProvider("storage");
  await Promise.all(rows.map((r) => (r.imageKey ? storage.delete(r.imageKey) : null)));
  await forget(ctx, "reference", id);
}

/* ─── Assets (usable media, always with rights) ─────────────────────────── */

export async function listAssets(ctx: WorkspaceContext, opts: { projectId?: string; kind?: "image" | "video" | "audio"; status?: ("candidate" | "approved" | "in_use")[] } = {}) {
  const conds = [eq(asset.organizationId, ctx.organization.id)];
  if (opts.projectId) conds.push(eq(asset.projectId, opts.projectId));
  if (opts.kind) conds.push(eq(asset.kind, opts.kind));
  conds.push(inArray(asset.usageStatus, opts.status ?? ["candidate", "approved", "in_use"]));
  return ctx.db.select().from(asset).where(and(...conds)).orderBy(desc(asset.createdAt)).limit(200);
}

/** Saves a sourced candidate. "approve" also stores image files locally so they survive provider changes. */
export async function saveSourcedAsset(ctx: WorkspaceContext, candidate: AssetCandidate, opts: { projectId?: string | null; campaignId?: string | null; approve: boolean; jobId?: string }) {
  assertCan(ctx, { asset: ["upload"] });
  if (opts.approve && !candidate.rights.commercialUse) {
    throw new AppError("VALIDATION", "This licence doesn't allow commercial use, so it can't be approved for production.");
  }
  let storageKey: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes = 0;
  const id = crypto.randomUUID();
  if (opts.approve && candidate.mediaType === "image") {
    const res = await fetch(candidate.mediaUrl, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const type = res?.headers.get("content-type")?.split(";")[0] ?? "";
    if (res?.ok && type.startsWith("image/")) {
      const body = new Uint8Array(await res.arrayBuffer());
      if (body.byteLength < 25_000_000) {
        storageKey = `${ctx.organization.id}/assets/${id}.${type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg"}`;
        await getProvider("storage").put({ key: storageKey, body, contentType: type });
        mimeType = type;
        sizeBytes = body.byteLength;
      }
    }
  }
  const [row] = await ctx.db
    .insert(asset)
    .values({
      id,
      organizationId: ctx.organization.id,
      projectId: opts.projectId ?? null,
      campaignId: opts.campaignId ?? null,
      kind: candidate.mediaType,
      source: "sourced",
      usageStatus: opts.approve ? "approved" : "candidate",
      name: candidate.title.slice(0, 200),
      storageProvider: storageKey ? "local" : null,
      storageKey,
      externalUrl: candidate.mediaUrl,
      thumbnailUrl: candidate.thumbnailUrl,
      mimeType,
      sizeBytes,
      width: candidate.width,
      height: candidate.height,
      durationMs: candidate.durationMs,
      rights: candidate.rights,
      jobId: opts.jobId ?? null,
      metadata: { provider: candidate.provider, externalId: candidate.externalId, pageUrl: candidate.pageUrl },
      createdById: ctx.userId,
    })
    .returning();
  if (opts.approve) await remember(ctx, "asset", row!.id, row!.name, { provider: candidate.provider, license: candidate.rights.license });
  return row!;
}

export async function setAssetStatus(ctx: WorkspaceContext, id: string, status: "approved" | "rejected" | "candidate") {
  assertCan(ctx, { asset: ["upload"] });
  const [row] = await ctx.db.select().from(asset).where(and(eq(asset.id, id), eq(asset.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Asset");
  if (status === "approved" && row.rights && !row.rights.commercialUse) {
    throw new AppError("VALIDATION", "This licence doesn't allow commercial use.");
  }
  await ctx.db.update(asset).set({ usageStatus: status }).where(eq(asset.id, id));
  if (status === "approved") await remember(ctx, "asset", id, row.name, { license: row.rights?.license });
  else await forget(ctx, "asset", id);
}

export async function deleteAsset(ctx: WorkspaceContext, id: string) {
  assertCan(ctx, { asset: ["delete"] });
  const [row] = await ctx.db.delete(asset).where(and(eq(asset.id, id), eq(asset.organizationId, ctx.organization.id))).returning();
  if (!row) throw notFound("Asset");
  if (row.storageKey) await getProvider("storage").delete(row.storageKey);
  await forget(ctx, "asset", id);
}

/* ─── Custom animation presets ──────────────────────────────────────────── */

const customPresetSchema = z.object({
  basePresetId: z.string(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
  params: z.record(z.string(), z.unknown()),
});

export async function listCustomPresets(ctx: WorkspaceContext) {
  return ctx.db.select().from(animationPreset).where(eq(animationPreset.organizationId, ctx.organization.id)).orderBy(desc(animationPreset.createdAt));
}

export async function saveCustomPreset(ctx: WorkspaceContext, input: unknown) {
  assertCan(ctx, { asset: ["upload"] });
  const data = customPresetSchema.parse(input);
  const base = getPreset(data.basePresetId);
  if (!base) throw new AppError("VALIDATION", "Unknown base preset.");
  const [row] = await ctx.db
    .insert(animationPreset)
    .values({ organizationId: ctx.organization.id, basePresetId: base.id, name: data.name, description: data.description ?? null, params: sanitizeParams(base, data.params), createdById: ctx.userId })
    .returning();
  return row!;
}

export async function deleteCustomPreset(ctx: WorkspaceContext, id: string) {
  assertCan(ctx, { asset: ["delete"] });
  await ctx.db.delete(animationPreset).where(and(eq(animationPreset.id, id), eq(animationPreset.organizationId, ctx.organization.id)));
  await forget(ctx, "animation", id);
}

/* ─── Creative spec (what the editor will build from) ───────────────────── */

export async function addAnimationToSpec(ctx: WorkspaceContext, campaignId: string, input: { presetId: string; role: AnimationRole; params: Record<string, unknown>; customPresetId?: string; name?: string }) {
  assertCan(ctx, { campaign: ["update"] });
  const preset = getPreset(input.presetId);
  if (!preset) throw new AppError("VALIDATION", "Unknown animation preset.");
  const [row] = await ctx.db.select().from(campaign).where(and(eq(campaign.id, campaignId), eq(campaign.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Campaign");
  const spec: CreativeSpec = row.creativeSpec ?? { animations: [], assets: [] };
  const next: CreativeSpec = {
    ...spec,
    animations: [
      ...spec.animations.filter((a) => a.role !== input.role || input.role === "transition"),
      { id: crypto.randomUUID(), role: input.role, presetId: preset.id, customPresetId: input.customPresetId, name: input.name ?? preset.name, params: sanitizeParams(preset, input.params) },
    ],
  };
  await ctx.db.update(campaign).set({ creativeSpec: next }).where(eq(campaign.id, campaignId));
  return { projectId: row.projectId };
}

export async function removeAnimationFromSpec(ctx: WorkspaceContext, campaignId: string, specId: string) {
  assertCan(ctx, { campaign: ["update"] });
  const [row] = await ctx.db.select().from(campaign).where(and(eq(campaign.id, campaignId), eq(campaign.organizationId, ctx.organization.id)));
  if (!row) throw notFound("Campaign");
  const spec = row.creativeSpec ?? { animations: [], assets: [] };
  await ctx.db.update(campaign).set({ creativeSpec: { ...spec, animations: spec.animations.filter((a) => a.id !== specId) } }).where(eq(campaign.id, campaignId));
}

/* ─── CreativeDNA ───────────────────────────────────────────────────────── */

export async function getCreativeDna(ctx: WorkspaceContext, projectId: string) {
  const [row] = await ctx.db.select().from(creativeDna).where(and(eq(creativeDna.projectId, projectId), eq(creativeDna.organizationId, ctx.organization.id)));
  return row ?? null;
}
