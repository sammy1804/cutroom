import { and, desc, eq, ilike, inArray, max, notInArray, or, sql, count } from "drizzle-orm";
import { asset, libraryItem, type LibraryItem } from "@/server/db/schema";
import { AppError, notFound } from "@/server/errors";
import { getProvider } from "@/server/providers/registry";
import { resolvePolyHavenFiles } from "@/server/library/polyhaven";
import { httpJson, HARVESTER_UA, type HarvestedItem } from "@/server/library/types";
import { remember } from "./library";
import { assertCan, type WorkspaceContext } from "./context";

/**
 * Open library: a shared catalog of openly licensed motion and media
 * (Poly Haven CC0, Animated Noto Emoji CC BY 4.0), harvested by the
 * library.* skills. Searching it costs nothing and needs no AI; an item is
 * copied into workspace storage, with its rights, only when someone uses it.
 */

export const OPEN_SOURCES = {
  polyhaven: { name: "Poly Haven", url: "https://polyhaven.com", license: "CC0 1.0", kinds: ["texture", "hdri"] },
  "noto-emoji": { name: "Animated Noto Emoji", url: "https://googlefonts.github.io/noto-emoji-animation/", license: "CC BY 4.0", kinds: ["lottie"] },
} as const;
export type OpenSource = keyof typeof OPEN_SOURCES;

export interface UpsertSummary {
  total: number;
  added: number;
  updated: number;
  unchanged: number;
  retired: number;
}

/**
 * Writes a source's full index. Items whose `sourceVersion` is unchanged are
 * skipped; items that disappeared from the source are retired (kept for
 * lineage, hidden from search).
 */
export async function upsertHarvest(ctx: WorkspaceContext, source: OpenSource, items: HarvestedItem[], opts: { kinds?: string[] } = {}): Promise<UpsertSummary> {
  const existing = await ctx.db
    .select({ externalId: libraryItem.externalId, sourceVersion: libraryItem.sourceVersion, active: libraryItem.active })
    .from(libraryItem)
    .where(and(eq(libraryItem.source, source), opts.kinds ? inArray(libraryItem.kind, opts.kinds as LibraryItem["kind"][]) : undefined));
  const known = new Map(existing.map((e) => [e.externalId, e]));
  const changed = items.filter((i) => {
    const prev = known.get(i.externalId);
    return !prev || !prev.active || prev.sourceVersion !== i.sourceVersion;
  });
  const added = changed.filter((i) => !known.has(i.externalId)).length;

  for (let i = 0; i < changed.length; i += 200) {
    const batch = changed.slice(i, i + 200).map((it) => ({ ...it, active: true, harvestedAt: new Date() }));
    await ctx.db
      .insert(libraryItem)
      .values(batch)
      .onConflictDoUpdate({
        target: [libraryItem.source, libraryItem.externalId],
        set: {
          kind: sql`excluded.kind`,
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          category: sql`excluded.category`,
          tags: sql`excluded.tags`,
          thumbnailUrl: sql`excluded.thumbnail_url`,
          previewUrl: sql`excluded.preview_url`,
          files: sql`excluded.files`,
          rights: sql`excluded.rights`,
          features: sql`excluded.features`,
          sourceVersion: sql`excluded.source_version`,
          active: true,
          harvestedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  const ids = items.map((i) => i.externalId);
  const retired = ids.length
    ? await ctx.db
        .update(libraryItem)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(libraryItem.source, source),
            eq(libraryItem.active, true),
            notInArray(libraryItem.externalId, ids),
            opts.kinds ? inArray(libraryItem.kind, opts.kinds as LibraryItem["kind"][]) : undefined,
          ),
        )
        .returning({ id: libraryItem.id })
    : [];

  return { total: items.length, added, updated: changed.length - added, unchanged: items.length - changed.length, retired: retired.length };
}

export async function openLibraryStats(ctx: WorkspaceContext) {
  const rows = await ctx.db
    .select({ source: libraryItem.source, kind: libraryItem.kind, n: count(), last: max(libraryItem.harvestedAt) })
    .from(libraryItem)
    .where(eq(libraryItem.active, true))
    .groupBy(libraryItem.source, libraryItem.kind);
  return rows;
}

export interface OpenLibraryQuery {
  q?: string;
  kind?: LibraryItem["kind"];
  source?: OpenSource;
  category?: string;
  limit?: number;
  offset?: number;
}

/** Keyword search over name, tags and category, most popular first. Deterministic and free. */
export async function searchOpenLibrary(ctx: WorkspaceContext, query: OpenLibraryQuery = {}) {
  const conds = [eq(libraryItem.active, true)];
  if (query.kind) conds.push(eq(libraryItem.kind, query.kind));
  if (query.source) conds.push(eq(libraryItem.source, query.source));
  if (query.category) conds.push(eq(libraryItem.category, query.category));
  const words = (query.q ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)
    .slice(0, 6);
  for (const w of words) {
    conds.push(
      or(
        ilike(libraryItem.name, `%${w}%`),
        ilike(libraryItem.category, `%${w}%`),
        sql`exists (select 1 from unnest(${libraryItem.tags}) t where t ilike ${`${w}%`})`,
      )!,
    );
  }
  const limit = Math.min(query.limit ?? 48, 96);
  const rows = await ctx.db
    .select()
    .from(libraryItem)
    .where(and(...conds))
    .orderBy(desc(sql`coalesce((${libraryItem.features}->>'popularity')::numeric, 0)`), libraryItem.name)
    .limit(limit + 1)
    .offset(query.offset ?? 0);
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function openLibraryCategories(ctx: WorkspaceContext, kind: LibraryItem["kind"]) {
  const rows = await ctx.db
    .select({ category: libraryItem.category, n: count() })
    .from(libraryItem)
    .where(and(eq(libraryItem.active, true), eq(libraryItem.kind, kind)))
    .groupBy(libraryItem.category)
    .orderBy(desc(count()))
    .limit(24);
  return rows.filter((r): r is { category: string; n: number } => Boolean(r.category));
}

export interface OpenLibraryCard {
  id: string;
  kind: "lottie" | "texture" | "hdri";
  source: string;
  name: string;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  sourceUrl: string;
  license: string;
  credit: string;
  attributionRequired: boolean;
}

export function toOpenLibraryCard(i: LibraryItem): OpenLibraryCard {
  return {
    id: i.id,
    kind: i.kind,
    source: i.source,
    name: i.name,
    category: i.category,
    tags: i.tags.slice(0, 8),
    thumbnailUrl: i.thumbnailUrl,
    previewUrl: i.previewUrl,
    sourceUrl: i.rights.sourceUrl,
    license: i.rights.license,
    credit: i.rights.credit,
    attributionRequired: i.rights.attributionRequired,
  };
}

const MAX_BYTES = 25_000_000;

async function download(url: string) {
  const res = await fetch(url, { headers: { "user-agent": HARVESTER_UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new AppError("PROVIDER_UNAVAILABLE", `Couldn't download from ${new URL(url).hostname} (${res.status}).`);
  const body = new Uint8Array(await res.arrayBuffer());
  if (body.byteLength > MAX_BYTES) throw new AppError("VALIDATION", "That file is too large to import.");
  return { body, type: res.headers.get("content-type")?.split(";")[0] ?? "" };
}

/**
 * Copies a catalog item into workspace storage as an approved asset with its
 * rights record, so projects never depend on the source staying online.
 * Importing the same item twice into a project returns the existing asset.
 */
export async function importLibraryItem(ctx: WorkspaceContext, itemId: string, opts: { projectId?: string | null } = {}) {
  assertCan(ctx, { asset: ["upload"] });
  const [item] = await ctx.db.select().from(libraryItem).where(and(eq(libraryItem.id, itemId), eq(libraryItem.active, true)));
  if (!item) throw notFound("Library item");

  const [already] = await ctx.db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.organizationId, ctx.organization.id),
        opts.projectId ? eq(asset.projectId, opts.projectId) : sql`${asset.projectId} is null`,
        sql`${asset.metadata}->>'libraryItemId' = ${item.id}`,
      ),
    )
    .limit(1);
  if (already) return { asset: already, created: false };

  let url: string;
  let ext: string;
  let kind: "image" | "animation";
  if (item.kind === "lottie") {
    url = item.files.lottie?.url ?? "";
    ext = "json";
    kind = "animation";
  } else {
    const files = await resolvePolyHavenFiles(item.externalId, item.kind, httpJson);
    if (!files.image) throw new AppError("PROVIDER_UNAVAILABLE", "Poly Haven has no web-ready image for this item.");
    url = files.image.url;
    ext = url.split("?")[0]!.split(".").pop()!.toLowerCase();
    kind = "image";
  }
  if (!url) throw new AppError("PROVIDER_UNAVAILABLE", "This item has no downloadable file.");

  const { body, type } = await download(url);
  if (kind === "animation") {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(body)) as { v?: unknown; layers?: unknown };
      if (!parsed.v || !Array.isArray(parsed.layers)) throw new Error();
    } catch {
      throw new AppError("PROVIDER_UNAVAILABLE", "The downloaded file isn't a valid Lottie animation.");
    }
  }
  const id = crypto.randomUUID();
  const storageKey = `${ctx.organization.id}/assets/${id}.${ext === "jpeg" ? "jpg" : ext}`;
  const contentType = kind === "animation" ? "application/json" : type || "image/jpeg";
  await getProvider("storage").put({ key: storageKey, body, contentType });

  const features = item.features as { maxResolution?: [number, number] };
  const [row] = await ctx.db
    .insert(asset)
    .values({
      id,
      organizationId: ctx.organization.id,
      projectId: opts.projectId ?? null,
      kind,
      source: "imported",
      usageStatus: "approved",
      name: item.name.slice(0, 200),
      storageProvider: "local",
      storageKey,
      externalUrl: url,
      thumbnailUrl: item.thumbnailUrl,
      mimeType: contentType,
      sizeBytes: body.byteLength,
      width: kind === "animation" ? 512 : (features.maxResolution?.[0] ?? null),
      height: kind === "animation" ? 512 : (features.maxResolution?.[1] ?? null),
      rights: { ...item.rights, collectedAt: new Date().toISOString() },
      tags: item.tags.slice(0, 20),
      metadata: { provider: item.source, externalId: item.externalId, libraryItemId: item.id, credit: item.rights.credit, libraryKind: item.kind },
      createdById: ctx.userId,
    })
    .returning();
  await remember(ctx, "asset", row!.id, row!.name, { provider: item.source, license: item.rights.license });
  return { asset: row!, created: true };
}
