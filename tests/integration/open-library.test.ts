import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/server/auth";
import { createDb, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { asset, libraryItem } from "@/server/db/schema";
import { normalizeNoto } from "@/server/library/noto";
import { normalizePolyHaven } from "@/server/library/polyhaven";
import type { WorkspaceContext } from "@/server/services/context";
import { importLibraryItem, searchOpenLibrary, upsertHarvest } from "@/server/services/open-library";
import { createWorkspace, findMembership } from "@/server/services/workspaces";
import { runSkill } from "@/server/skills/runtime";
import { specCredits } from "@/lib/creative-spec/ops";
import { creativeSpecSchema } from "@/lib/creative-spec/schema";

/** In-memory storage so imports never touch disk. */
const stored = new Map<string, Uint8Array>();
vi.mock("@/server/providers/registry", () => ({
  getProvider: () => ({
    put: async ({ key, body }: { key: string; body: Uint8Array }) => void stored.set(key, body),
    get: async (key: string) => stored.get(key) ?? null,
    delete: async (key: string) => void stored.delete(key),
  }),
}));

/* Payloads shaped like the live APIs (checked 13 Oct 2026). */
const PH_TEXTURES = {
  aerial_asphalt_01: {
    type: 1,
    name: "Aerial Asphalt 01",
    tags: ["road", "Flat", "cracked"],
    categories: ["asphalt", "outdoor"],
    category: "Asphalt & Bitumen/Asphalt/Worn Road Surface",
    authors: { "Rob Tuytel": "All" },
    download_count: 147685,
    max_resolution: [8192, 8192],
    files_hash: "cdf3c8f0",
    thumbnail_url: "https://cdn.polyhaven.com/asset_img/thumbs/aerial_asphalt_01.png?width=256&height=256",
  },
  rock_wall: { type: 1, name: "Rock Wall", tags: ["rock"], categories: ["natural"], authors: { "Dario Barresi": "All" }, download_count: 900, files_hash: "aaa" },
};
const PH_FILES = {
  Diffuse: { "1k": { jpg: { url: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_asphalt_01/aerial_asphalt_01_diff_1k.jpg", size: 10 } } },
};
const NOTO = {
  icons: [
    { name: "emoji_u1f600", codepoint: "1f600", popularity: 881, categories: ["Smileys and emotions"], tags: [":smile:"], version: 1 },
    { name: "emoji_u1f680", codepoint: "1f680", popularity: 700, categories: ["Travel and places"], tags: [":rocket:"], version: 1 },
  ],
};
const LOTTIE = { v: "5.7.4", fr: 30, w: 512, h: 512, op: 60, layers: [] };

function stubFetch() {
  const calls: { url: string; ua: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, ua: new Headers(init?.headers).get("user-agent") });
      const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
      if (url.includes("api.polyhaven.com/assets?type=textures")) return json(PH_TEXTURES);
      if (url.includes("api.polyhaven.com/assets?type=hdris")) return json({});
      if (url.includes("api.polyhaven.com/files/")) return json(PH_FILES);
      if (url.includes("noto-emoji-animation/data/api.json")) return json(NOTO);
      if (url.endsWith("/lottie.json")) return json(LOTTIE);
      if (url.endsWith(".jpg")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
      return new Response("not found", { status: 404 });
    }),
  );
  return calls;
}

describe("open library normalisers", () => {
  it("maps a Poly Haven texture to a CC0 catalog item with Poly Haven credit", () => {
    const item = normalizePolyHaven("aerial_asphalt_01", PH_TEXTURES.aerial_asphalt_01 as never)!;
    expect(item).toMatchObject({ source: "polyhaven", externalId: "aerial_asphalt_01", kind: "texture", category: "Asphalt & Bitumen", sourceVersion: "cdf3c8f0" });
    expect(item.tags).toEqual(expect.arrayContaining(["road", "flat", "asphalt"]));
    expect(item.rights).toMatchObject({ license: "CC0 1.0", attributionRequired: false, commercialUse: true, creator: "Rob Tuytel" });
    expect(item.rights.credit).toContain("Poly Haven");
    expect(item.files).toEqual({});
    expect(normalizePolyHaven("model", { type: 2, name: "Chair" } as never)).toBeNull();
  });

  it("maps a Noto emoji to a CC BY Lottie item that carries its credit", () => {
    const item = normalizeNoto(NOTO.icons[1]!);
    expect(item).toMatchObject({ kind: "lottie", externalId: "1f680", name: "🚀 Rocket", category: "Travel and places" });
    expect(item.files.lottie?.url).toBe("https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/lottie.json");
    expect(item.thumbnailUrl).toMatch(/128\.png$/);
    expect(item.rights).toMatchObject({ license: "CC BY 4.0", attributionRequired: true, credit: "Animated Noto Emoji by Google, CC BY 4.0" });
    expect(normalizeNoto({ ...NOTO.icons[0]!, codepoint: "1f1ee_1f1f3", tags: [":flag-india:"] }).name).toBe("🇮🇳 Flag India");
  });

  it("collects distinct credits from a spec", () => {
    const spec = creativeSpecSchema.parse({
      version: 1,
      title: "t",
      aspect: "9:16",
      fps: 30,
      style: { background: "#000", foreground: "#fff", accent: "#f60" },
      scenes: [
        { id: "scene_01", duration: 2, elements: [{ id: "scene_01.lottie", type: "lottie", src: "/x.json", credit: "Animated Noto Emoji by Google, CC BY 4.0" }] },
        { id: "scene_02", duration: 2, elements: [{ id: "scene_02.lottie", type: "lottie", src: "/y.json", credit: "Animated Noto Emoji by Google, CC BY 4.0" }] },
      ],
    });
    expect(specCredits(spec)).toEqual(["Animated Noto Emoji by Google, CC BY 4.0"]);
  });
});

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("open library harvest (postgres)", () => {
  let db: Database;
  let ctx: WorkspaceContext;

  beforeAll(async () => {
    db = createDb(url!);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(url!);
    const auth = createAuth({ db, secret: "test-secret-".padEnd(40, "x"), baseURL: "http://localhost:3000" });
    const { user } = await auth.api.signUpEmail({ body: { name: "Mara Lind", email: "mara@library.test", password: "correct-horse-1" } });
    const ws = await createWorkspace(auth, db, user.id, { name: "Library Lab" });
    const m = (await findMembership(db, user.id, ws.slug))!;
    ctx = { db, userId: user.id, organization: m.organization, role: m.role };
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await db?.$client.end();
  });

  it("harvests Poly Haven through the skill, identifying itself, then skips unchanged items", async () => {
    const calls = stubFetch();
    const first = await runSkill<{ results: { type: string; added: number; unchanged: number }[] }>(ctx, "library.harvest-polyhaven", { types: ["textures"] }, { reason: "test" });
    expect(first.output.results[0]).toMatchObject({ type: "textures", added: 2, unchanged: 0 });
    expect(calls.every((c) => c.ua?.startsWith("Cutroom-Library-Harvester/"))).toBe(true);

    const second = await runSkill<{ results: { added: number; updated: number; unchanged: number }[] }>(ctx, "library.harvest-polyhaven", { types: ["textures"] }, { reason: "test", useCache: false });
    expect(second.output.results[0]).toMatchObject({ added: 0, updated: 0, unchanged: 2 });
  });

  it("refuses an empty index instead of retiring the catalog", async () => {
    stubFetch();
    await expect(runSkill(ctx, "library.harvest-polyhaven", { types: ["hdris"] }, { reason: "test" })).rejects.toThrow(/EMPTY_INDEX/);
    const { items } = await searchOpenLibrary(ctx, { kind: "texture" });
    expect(items).toHaveLength(2);
  });

  it("updates changed items and retires ones the source removed", async () => {
    const [a] = [normalizePolyHaven("aerial_asphalt_01", { ...PH_TEXTURES.aerial_asphalt_01, files_hash: "new" } as never)!];
    const summary = await upsertHarvest(ctx, "polyhaven", [a!], { kinds: ["texture"] });
    expect(summary).toMatchObject({ total: 1, added: 0, updated: 1, retired: 1 });
    const { items } = await searchOpenLibrary(ctx, { kind: "texture" });
    expect(items.map((i) => i.externalId)).toEqual(["aerial_asphalt_01"]);
  });

  it("harvests Noto emoji and searches by tag, most popular first", async () => {
    stubFetch();
    const { output } = await runSkill<{ added: number }>(ctx, "library.harvest-noto-emoji", {}, { reason: "test" });
    expect(output.added).toBe(2);
    expect((await searchOpenLibrary(ctx, { q: "rocket" })).items.map((i) => i.externalId)).toEqual(["1f680"]);
    expect((await searchOpenLibrary(ctx, { kind: "lottie" })).items.map((i) => i.externalId)).toEqual(["1f600", "1f680"]);
    const viaSkill = await runSkill<{ items: { credit: string }[] }>(ctx, "library.open-library-search", { query: "smile" }, { reason: "test" });
    expect(viaSkill.output.items[0]?.credit).toContain("CC BY 4.0");
  });

  it("imports into workspace storage with rights, once per project", async () => {
    stubFetch();
    const [rocket] = await db.select().from(libraryItem).where(eq(libraryItem.externalId, "1f680"));
    const first = await importLibraryItem(ctx, rocket!.id);
    expect(first.created).toBe(true);
    expect(first.asset).toMatchObject({ kind: "animation", source: "imported", usageStatus: "approved", mimeType: "application/json" });
    expect(first.asset.rights).toMatchObject({ license: "CC BY 4.0", attributionRequired: true });
    expect(first.asset.metadata).toMatchObject({ credit: "Animated Noto Emoji by Google, CC BY 4.0", libraryItemId: rocket!.id });
    expect(stored.get(first.asset.storageKey!)).toBeTruthy();
    expect((await importLibraryItem(ctx, rocket!.id)).created).toBe(false);

    const [asphalt] = await db.select().from(libraryItem).where(eq(libraryItem.externalId, "aerial_asphalt_01"));
    const tex = await importLibraryItem(ctx, asphalt!.id);
    expect(tex.asset).toMatchObject({ kind: "image", mimeType: "image/jpeg" });
    expect(tex.asset.storageKey).toMatch(/\.jpg$/);
    expect(await db.select().from(asset)).toHaveLength(2);
  });

  it("rejects a download that isn't a Lottie file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ hello: "world" }))));
    const [smile] = await db.select().from(libraryItem).where(eq(libraryItem.externalId, "1f600"));
    await expect(importLibraryItem(ctx, smile!.id)).rejects.toThrow(/valid Lottie/);
  });
});
