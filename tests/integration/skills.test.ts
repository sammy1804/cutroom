import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SKILLS } from "@skills/registry.generated";
import type { AIProvider } from "@/server/ai/provider";
import { recordUsage } from "@/server/ai/usage";
import { createAuth } from "@/server/auth";
import { createDb, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { skillRun } from "@/server/db/schema";
import type { WorkspaceContext } from "@/server/services/context";
import { createWorkspace, findMembership } from "@/server/services/workspaces";
import { discoverSkills, getSkill, listSkills } from "@/server/skills/registry";
import { runSkill } from "@/server/skills/runtime";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

/** Stand-in provider for tests: returns a fixed storyboard and records usage like a real call. */
const fakeAI: AIProvider = {
  id: "test",
  label: "Test provider",
  available: () => true,
  async structured() {
    recordUsage({ provider: "test", model: "test-model", inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, costUsd: 0.014 });
    return {
      title: "Second Life",
      shots: [
        { purpose: "hook", duration: 2, headline: "Waste is a material.", layout: "center", camera: "slow push", visual: "rubble close-up", animation: "text-kinetic-scale", background: "#141210", transition: "transition-whip-pan", audio: "beat hit" },
        { purpose: "payoff", duration: 3, headline: "Build it again.", subtitle: "Recovered concrete, second life.", layout: "bottom", camera: "static", visual: "none", animation: "not-a-preset", background: "background-grain", transition: null, audio: "riser" },
      ],
    } as never;
  },
  async research() {
    throw new Error("not used");
  },
};

describe("skill registry", () => {
  it("has unique ids, valid metadata and implementations only for ready skills", () => {
    const ids = SKILLS.map((s) => s.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SKILLS) {
      expect(s.meta.id.startsWith(`${s.meta.category}.`)).toBe(true);
      expect(Boolean(s.definition)).toBe(s.meta.status === "ready");
      if (s.definition) expect(s.definition.id).toBe(s.meta.id);
    }
    expect(listSkills().length).toBeGreaterThanOrEqual(13);
    expect(listSkills({ includePlanned: true }).length).toBeGreaterThan(listSkills().length);
  });

  it("discovers relevant skills without loading instructions", () => {
    const video = discoverSkills({ query: "Which skills can help me understand this video?", includePlanned: true });
    expect(video[0]?.meta.category).toBe("media");
    expect(discoverSkills({ produces: "MotionDNA", includePlanned: true }).map((d) => d.meta.id)).toContain("media.motion-analysis");
    expect(discoverSkills({ query: "find a liquid transition" })[0]?.meta.id).toMatch(/^motion\./);
    expect(discoverSkills({ query: "storyboard shots" })[0]?.meta.id).toBe("creative.storyboard");
  });

  it("refuses planned skills clearly", () => {
    expect(() => getSkill("media.video-analysis")).toThrow(/planned but not built/);
  });
});

describeDb("skill runtime (postgres)", () => {
  let db: Database;
  let ctx: WorkspaceContext;

  beforeAll(async () => {
    db = createDb(url!);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(url!);
    const auth = createAuth({ db, secret: "test-secret-".padEnd(40, "x"), baseURL: "http://localhost:3000" });
    const { user } = await auth.api.signUpEmail({ body: { name: "Rui Okafor", email: "rui@skills.test", password: "correct-horse-1" } });
    const ws = await createWorkspace(auth, db, user.id, { name: "Skill Lab" });
    const m = (await findMembership(db, user.id, ws.slug))!;
    ctx = { db, userId: user.id, organization: m.organization, role: m.role };
  });
  afterAll(async () => db?.$client.end());

  it("validates input and logs failures", async () => {
    await expect(runSkill(ctx, "motion.animation-catalog-search", { query: 42 }, { reason: "test" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("runs a deterministic skill and records the run", async () => {
    const { output, runId } = await runSkill<{ presets: { id: string }[] }>(ctx, "motion.animation-catalog-search", { query: "liquid", category: "transition" }, { reason: "test search" });
    expect(output.presets[0]?.id).toBe("transition-liquid");
    const [row] = await db.select().from(skillRun).where(sql`${skillRun.id} = ${runId}`);
    expect(row).toMatchObject({ status: "succeeded", skillId: "motion.animation-catalog-search", reason: "test search", costUsd: 0 });
  });

  it("runs an AI skill through the provider, captures usage, then serves identical input from cache", async () => {
    const input = { idea: "Construction waste can become a resource", direction: { id: "second-life", title: "Second Life", premise: "Waste is a material", why: "x", visualTerritory: "raw concrete", storytelling: "before/after", tone: "calm", palette: ["#141210", "#e9e4da", "#d9732b"], motion: ["text-kinetic-scale"], references: [] }, format: "9:16", targetSeconds: 5 };
    const first = await runSkill<{ shots: unknown[] }>(ctx, "creative.storyboard", input, { reason: "storyboard", ai: fakeAI });
    expect(first.cached).toBe(false);
    const [row] = await db.select().from(skillRun).where(sql`${skillRun.id} = ${first.runId}`);
    expect(row).toMatchObject({ status: "succeeded", provider: "test", inputTokens: 1000, outputTokens: 500 });
    expect(row!.costUsd).toBeCloseTo(0.014);
  });

  it("compiles a storyboard into a valid CreativeSpec with stable ids and safe fallbacks", async () => {
    const shots = [
      { purpose: "hook", duration: 2, headline: "Waste is a material.", layout: "center", camera: "slow push", visual: "rubble", animation: "text-kinetic-scale", background: "#141210", transition: "transition-whip-pan", audio: "beat" },
      { purpose: "payoff", duration: 3, headline: "Build it again.", subtitle: "Second life.", layout: "bottom", camera: "static", visual: "none", animation: "not-a-preset", background: "background-grain", transition: null, audio: "riser" },
    ];
    const { output: spec } = await runSkill<{ scenes: { id: string; elements: { id: string; animation: { presetId: string } | null }[]; background: { preset: unknown }; transition: unknown }[]; style: { background: string; foreground: string } }>(
      ctx,
      "production.spec-compile",
      { title: "Second Life", aspect: "9:16", palette: ["#141210", "#e9e4da", "#d9732b"], shots },
      { reason: "compile" },
    );
    expect(spec.scenes.map((s) => s.id)).toEqual(["scene_01", "scene_02"]);
    expect(spec.scenes[1]!.elements.map((e) => e.id)).toEqual(["scene_02.headline", "scene_02.subtitle"]);
    expect(spec.scenes[1]!.elements[0]!.animation!.presetId).toBe("text-mask-reveal");
    expect(spec.scenes[1]!.background.preset).toMatchObject({ presetId: "background-grain" });
    expect(spec.scenes[0]!.transition).toMatchObject({ presetId: "transition-whip-pan" });
    expect(spec.style).toMatchObject({ background: "#141210", foreground: "#e9e4da" });

    const { output: qc } = await runSkill<{ score: number; issues: { target: string }[] }>(ctx, "production.quality-control", { spec }, { reason: "qc" });
    expect(qc.score).toBeGreaterThan(50);
  });

  it("caches cacheable skills by input", async () => {
    const input = { query: "subtle editorial headline", context: "test" };
    let calls = 0;
    const ai: AIProvider = { ...fakeAI, async structured() { calls++; return { interpretation: "x", recommendations: [{ presetId: "text-mask-reveal", why: "editorial", params: [] }], combinations: [] } as never; } };
    const a = await runSkill(ctx, "motion.animation-search", input, { reason: "cache 1", ai });
    const b = await runSkill(ctx, "motion.animation-search", input, { reason: "cache 2", ai });
    expect([a.cached, b.cached, calls]).toEqual([false, true, 1]);
    expect(b.output).toEqual(a.output);
  });
});
