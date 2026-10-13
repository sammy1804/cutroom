import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, type Auth } from "@/server/auth";
import { createDb, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { AppError } from "@/server/errors";
import type { WorkspaceContext } from "@/server/services/context";
import { createCampaign, getCampaign, listRecentCampaigns, setCampaignStatus } from "@/server/services/campaigns";
import { createProject, getProject, getWorkspaceStats, listProjects, setProjectArchived } from "@/server/services/projects";
import { createWorkspace, findMembership, listMembers, listWorkspacesForUser } from "@/server/services/workspaces";
import { reference } from "@/server/db/schema";
import { addAnimationToSpec, listMemory, removeAnimationFromSpec, saveCustomPreset, saveSourcedAsset, setReferenceStatus } from "@/server/services/library";
import { listSources, resolveApprovedSite, setSourceEnabled } from "@/server/services/sources";
import type { AssetCandidate } from "@/server/providers/assets/types";

/**
 * End-to-end check of the Phase 1 data layer against a real Postgres:
 * migrations → sign-up/sign-in → workspace → projects → campaigns, plus
 * role enforcement and tenant isolation.
 */

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("foundation (postgres)", () => {
  let db: Database;
  let auth: Auth;

  async function signUp(name: string, email: string) {
    const res = await auth.api.signUpEmail({ body: { name, email, password: "correct-horse-1" } });
    return res.user;
  }

  async function ctxFor(userId: string, slug: string): Promise<WorkspaceContext> {
    const m = await findMembership(db, userId, slug);
    if (!m) throw new Error("not a member");
    return { db, userId, organization: m.organization, role: m.role };
  }

  beforeAll(async () => {
    db = createDb(url!);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(url!);
    auth = createAuth({ db, secret: "test-secret-".padEnd(40, "x"), baseURL: "http://localhost:3000" });
  });

  afterAll(async () => {
    await db?.$client.end();
  });

  it("applies migrations idempotently", async () => {
    await runMigrations(url!);
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "account", "animation_preset", "asset", "brain_thread", "campaign", "composition", "creative_dna", "creative_memory", "invitation", "job", "library_item", "member", "organization", "project", "reference", "session", "skill_run", "source", "user", "verification",
    ]);
  });

  it("signs up, rejects bad passwords and signs in", async () => {
    const user = await signUp("Ines Varga", "ines@halden.test");
    expect(user.email).toBe("ines@halden.test");
    await expect(
      auth.api.signInEmail({ body: { email: "ines@halden.test", password: "wrong-password" } }),
    ).rejects.toThrow();
    const ok = await auth.api.signInEmail({ body: { email: "ines@halden.test", password: "correct-horse-1" } });
    expect(ok.token).toBeTruthy();
    await expect(signUp("Dup", "ines@halden.test")).rejects.toThrow();
  });

  it("creates a workspace with the creator as owner and a unique slug", async () => {
    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const ws = await createWorkspace(auth, db, ines!.id, { name: "Northlight Studio" });
    expect(ws.slug).toBe("northlight-studio");
    const again = await createWorkspace(auth, db, ines!.id, { name: "Northlight Studio" });
    expect(again.slug).toBe("northlight-studio-2");

    const workspaces = await listWorkspacesForUser(db, ines!.id);
    expect(workspaces.map((w) => [w.slug, w.role])).toEqual([
      ["northlight-studio", "owner"],
      ["northlight-studio-2", "owner"],
    ]);
    await expect(createWorkspace(auth, db, ines!.id, { name: "x" })).rejects.toThrow();
  });

  it("creates projects and campaigns, and reports stats", async () => {
    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const ctx = await ctxFor(ines!.id, "northlight-studio");

    const project = await createProject(ctx, { name: "Halden Coffee", websiteUrl: "haldencoffee.com" });
    expect(project).toMatchObject({ slug: "halden-coffee", websiteUrl: "https://haldencoffee.com", status: "active" });
    const twin = await createProject(ctx, { name: "Halden Coffee" });
    expect(twin.slug).toBe("halden-coffee-2");

    const campaign = await createCampaign(ctx, project.id, {
      name: "Autumn single-origin drop",
      objective: "launch",
      channels: ["instagram_reels", "tiktok"],
      aspectRatios: ["9:16", "1:1"],
      dueDate: "2026-11-14",
    });
    expect(campaign).toMatchObject({ status: "draft", channels: ["instagram_reels", "tiktok"], dueDate: "2026-11-14" });

    await setCampaignStatus(ctx, campaign.id, "in_production");
    expect(await getWorkspaceStats(ctx)).toMatchObject({ projects: 2, inProduction: 1, drafts: 0 });

    const listed = await listProjects(ctx);
    expect(listed.find((p) => p.id === project.id)).toMatchObject({ campaignCount: 1, activeCampaignCount: 1 });
    expect((await listRecentCampaigns(ctx))[0]).toMatchObject({ name: "Autumn single-origin drop", project: { name: "Halden Coffee" } });

    await setProjectArchived(ctx, twin.id, true);
    expect((await listProjects(ctx)).map((p) => p.id)).not.toContain(twin.id);
    expect((await listProjects(ctx, { status: "archived" })).map((p) => p.id)).toEqual([twin.id]);
  });

  it("enforces roles for invited members", async () => {
    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const owner = await ctxFor(ines!.id, "northlight-studio");
    const tomas = await signUp("Tomás Reyes", "tomas@halden.test");
    await auth.api.addMember({ body: { userId: tomas.id, role: "viewer", organizationId: owner.organization.id } });

    const viewer = await ctxFor(tomas.id, "northlight-studio");
    expect(viewer.role).toBe("viewer");
    expect(await listProjects(viewer)).toHaveLength(1); // can read
    await expect(createProject(viewer, { name: "Sneaky" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect((await listMembers(owner)).map((m) => m.role)).toEqual(["owner", "viewer"]);
  });

  it("isolates workspaces from each other", async () => {
    const mara = await signUp("Mara Lindqvist", "mara@other.test");
    const ws = await createWorkspace(auth, db, mara.id, { name: "Other Agency" });
    const other = await ctxFor(mara.id, ws.slug);

    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const owner = await ctxFor(ines!.id, "northlight-studio");
    const [project] = await listProjects(owner);
    const campaign = (await listRecentCampaigns(owner))[0]!;

    expect(await findMembership(db, mara.id, "northlight-studio")).toBeNull();
    await expect(getProject(other, project!.id)).rejects.toBeInstanceOf(AppError);
    await expect(getCampaign(other, campaign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createCampaign(other, project!.id, { name: "Hijack" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listProjects(other)).toEqual([]);
  });

  it("seeds the source registry and only opens approved sites", async () => {
    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const ctx = await ctxFor(ines!.id, "northlight-studio");
    const sources = await listSources(ctx);
    expect(sources.length).toBeGreaterThanOrEqual(15);
    expect(await listSources(ctx)).toHaveLength(sources.length); // idempotent

    expect(await resolveApprovedSite(ctx, "https://www.behance.net/gallery/123")).toMatchObject({ name: "Behance" });
    expect(await resolveApprovedSite(ctx, "https://haldencoffee.com/shop")).toMatchObject({ sourceId: null });
    await expect(resolveApprovedSite(ctx, "https://random-site.example")).rejects.toMatchObject({ code: "FORBIDDEN" });

    const behance = sources.find((s) => s.key === "behance")!;
    await setSourceEnabled(ctx, behance.id, false);
    await expect(resolveApprovedSite(ctx, "https://www.behance.net/gallery/123")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to approve assets whose licence forbids commercial use", async () => {
    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const ctx = await ctxFor(ines!.id, "northlight-studio");
    const candidate = (commercial: boolean): AssetCandidate => ({
      provider: "openverse",
      externalId: crypto.randomUUID(),
      title: "Forest walk",
      mediaType: "audio",
      thumbnailUrl: null,
      mediaUrl: "https://example.org/a.mp3",
      pageUrl: "https://example.org/a",
      width: null,
      height: null,
      durationMs: 30_000,
      rights: { source: "Openverse", sourceUrl: "https://example.org/a", creator: "R. Ash", license: commercial ? "CC BY 4.0" : "CC BY-NC 4.0", licenseUrl: null, attributionRequired: true, commercialUse: commercial, modificationAllowed: true, collectedAt: new Date().toISOString() },
    });
    await expect(saveSourcedAsset(ctx, candidate(false), { approve: true })).rejects.toMatchObject({ code: "VALIDATION" });
    const saved = await saveSourcedAsset(ctx, candidate(false), { approve: false });
    expect(saved).toMatchObject({ usageStatus: "candidate", rights: { license: "CC BY-NC 4.0" } });
    const approved = await saveSourcedAsset(ctx, candidate(true), { approve: true });
    expect(approved.usageStatus).toBe("approved");
    expect((await listMemory(ctx)).some((m) => m.kind === "asset" && m.subjectId === approved.id)).toBe(true);
  });

  it("turns approved references into company memory and builds a creative spec", async () => {
    const [ines] = await db.execute<{ id: string }>(sql`select id from "user" where email = 'ines@halden.test'`).then((r) => r.rows);
    const ctx = await ctxFor(ines!.id, "northlight-studio");
    const [proj] = await listProjects(ctx);
    const [ref] = await db
      .insert(reference)
      .values({ organizationId: ctx.organization.id, projectId: proj!.id, url: "https://haldencoffee.com", title: "Halden home page", tags: ["editorial"] })
      .returning();
    await setReferenceStatus(ctx, ref!.id, "approved");
    expect((await listMemory(ctx)).find((m) => m.subjectId === ref!.id)).toMatchObject({ kind: "reference", title: "Halden home page" });
    await setReferenceStatus(ctx, ref!.id, "rejected");
    expect((await listMemory(ctx)).find((m) => m.subjectId === ref!.id)).toBeUndefined();

    const preset = await saveCustomPreset(ctx, { basePresetId: "text-kinetic-scale", name: "Halden punch", params: { intensity: 30, duration: 50 } });
    expect(preset.params).toMatchObject({ intensity: 30, duration: 4 });

    const campaign = (await listRecentCampaigns(ctx))[0]!;
    await addAnimationToSpec(ctx, campaign.id, { presetId: "text-mask-reveal", role: "headline", params: {} });
    await addAnimationToSpec(ctx, campaign.id, { presetId: "text-blur-in", role: "headline", params: {} });
    await addAnimationToSpec(ctx, campaign.id, { presetId: "transition-liquid", role: "transition", params: {} });
    let spec = (await getCampaign(ctx, campaign.id)).creativeSpec;
    expect(spec.animations.map((a) => [a.role, a.presetId])).toEqual([
      ["headline", "text-blur-in"],
      ["transition", "transition-liquid"],
    ]);
    await removeAnimationFromSpec(ctx, campaign.id, spec.animations[0]!.id);
    spec = (await getCampaign(ctx, campaign.id)).creativeSpec;
    expect(spec.animations).toHaveLength(1);
    await expect(addAnimationToSpec(ctx, campaign.id, { presetId: "nope", role: "headline", params: {} })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
