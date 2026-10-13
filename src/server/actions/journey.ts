"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Storyboard } from "@skills/creative/storyboard/skill";
import { composition, project as projectTable } from "@/server/db/schema";
import { AppError, runAction } from "@/server/errors";
import { startJob } from "@/server/jobs/runner";
import { actionWorkspace } from "@/server/session";
import { assertCan, type WorkspaceContext } from "@/server/services/context";
import { getCreativeDna, listMemory, listReferences, remember } from "@/server/services/library";
import { getProject } from "@/server/services/projects";
import { getBoardState, replaceBoard } from "@/server/services/board";
import { boardFromSpec } from "@/lib/board";
import { runSkill } from "@/server/skills/runtime";
import { creativeSpecSchema, type CreativeSpecDoc } from "@/lib/creative-spec/schema";
import type { CreativeDirection } from "@/lib/creative-types";
import type { QualityReport } from "@/lib/skill-types";

/**
 * The project journey: IDEA → EXPLORE → DIRECTION → STORY → DESIGN → MOTION → FINAL.
 * AI work goes through skills (observable, validated, cached); the rest is data.
 */

export type Stage = "idea" | "explore" | "direction" | "story" | "design" | "motion" | "final";
const STAGES: Stage[] = ["idea", "explore", "direction", "story", "design", "motion", "final"];

const refresh = (slug: string, projectId: string) => revalidatePath(`/w/${slug}/projects/${projectId}`);

async function editable(slug: string, projectId: string) {
  const ctx = await actionWorkspace(slug);
  assertCan(ctx, { project: ["update"] });
  const project = await getProject(ctx, projectId);
  return { ctx, project };
}

async function update(ctx: WorkspaceContext, projectId: string, values: Partial<typeof projectTable.$inferInsert>) {
  await ctx.db.update(projectTable).set(values).where(and(eq(projectTable.id, projectId), eq(projectTable.organizationId, ctx.organization.id)));
}

/** Lays a spec out on the board as connected frames, keeping the board's notes and references. */
async function layOut(ctx: WorkspaceContext, projectId: string, spec: CreativeSpecDoc) {
  const { board } = await getBoardState(ctx, projectId);
  await replaceBoard(ctx, projectId, boardFromSpec(spec, { items: board.items }, { x: 0, y: board.items.length ? Math.max(...board.items.map((i) => i.y + i.h)) + 80 : 0 }));
}

/** Only ever move forward automatically; people can still jump back to any stage. */
const advance = (current: Stage, to: Stage): Stage => (STAGES.indexOf(to) > STAGES.indexOf(current) ? to : current);

export async function setStageAction(slug: string, projectId: string, stage: Stage) {
  return runAction(async () => {
    const { ctx } = await editable(slug, projectId);
    if (!STAGES.includes(stage)) throw new AppError("VALIDATION", "Unknown stage.");
    await update(ctx, projectId, { stage });
    refresh(slug, projectId);
  });
}

const ideaSchema = z.object({
  idea: z.string().trim().min(8, "Say a little more about the idea.").max(3000),
  audience: z.string().trim().max(500).optional(),
  format: z.enum(["9:16", "1:1", "4:5", "16:9"]),
});

export async function saveIdeaAction(slug: string, projectId: string, input: z.input<typeof ideaSchema>) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    const data = ideaSchema.parse(input);
    await update(ctx, projectId, { idea: data.idea, audience: data.audience ?? null, format: data.format, stage: advance(project.stage, "explore") });
    refresh(slug, projectId);
  });
}

/** EXPLORE: research the idea itself (not tied to a campaign). */
export async function researchIdeaAction(slug: string, projectId: string, focus?: string) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    assertCan(ctx, { job: ["create"] });
    if (!project.idea) throw new AppError("VALIDATION", "Write the idea first.");
    const context = [`Project: ${project.name}`, project.description, project.websiteUrl && `Website: ${project.websiteUrl}`, project.audience && `Audience: ${project.audience}`, `Format: ${project.format}`]
      .filter(Boolean)
      .join("\n");
    const question = focus?.trim() || `How should we approach this idea, and what does the category already do? Idea: ${project.idea}`;
    const job = await startJob(ctx, { kind: "research", input: { focus: focus ?? null }, projectId }, async (report) => {
      const { output } = await runSkill(ctx, "research.web-research", { question, context }, { reason: `Explore "${project.name}"`, projectId, onProgress: report });
      return output as Record<string, unknown>;
    });
    refresh(slug, projectId);
    return { jobId: job.id };
  });
}

/** DIRECTION: three directions from the idea, research and approved references. */
export async function suggestDirectionsAction(slug: string, projectId: string) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    if (!project.idea) throw new AppError("VALIDATION", "Write the idea first.");
    const [refs, memory, research] = await Promise.all([
      listReferences(ctx, { projectId, status: "approved", limit: 12 }),
      listMemory(ctx, 30),
      import("@/server/jobs/runner").then((m) => m.latestJob(ctx, { kind: "research", projectId })),
    ]);
    const report = research?.status === "succeeded" ? (research.output as { summary?: string; visualDirections?: string[]; hooks?: string[] }) : null;
    const { output } = await runSkill<{ directions: CreativeDirection[] }>(
      ctx,
      "creative.creative-direction",
      {
        idea: project.idea,
        audience: project.audience ?? undefined,
        format: project.format,
        research: report ? [report.summary, report.visualDirections?.join("; "), report.hooks?.join("; ")].filter(Boolean).join("\n") : undefined,
        references: refs.map((r) => ({ title: r.title, learnings: r.analysis?.learnings ?? [], motion: r.analysis?.motion })),
        memory: memory.filter((m) => m.kind === "direction" || m.kind === "animation").map((m) => `${m.kind}: ${m.title}`),
      },
      { reason: `Directions for "${project.name}"`, projectId },
    );
    const directions = output.directions.map((d, i) => ({ ...d, id: `${d.id || "direction"}-${i + 1}`.toLowerCase().replace(/[^a-z0-9-]/g, "-") }));
    await update(ctx, projectId, { directions, stage: advance(project.stage, "direction") });
    refresh(slug, projectId);
    return { count: directions.length };
  });
}

export async function chooseDirectionAction(slug: string, projectId: string, directionId: string) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    const chosen = project.directions.find((d) => d.id === directionId);
    if (!chosen) throw new AppError("NOT_FOUND", "That direction is no longer available.");
    await update(ctx, projectId, { chosenDirection: chosen, stage: advance(project.stage, "story") });
    refresh(slug, projectId);
  });
}

/** STORY: storyboard skill → spec-compile skill → CreativeSpec. */
export async function draftStoryboardAction(slug: string, projectId: string, targetSeconds = 15) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    if (!project.idea || !project.chosenDirection) throw new AppError("VALIDATION", "Choose a direction first.");
    const dna = await getCreativeDna(ctx, projectId);
    const board = await runSkill<Storyboard>(
      ctx,
      "creative.storyboard",
      {
        idea: project.idea,
        direction: project.chosenDirection,
        format: project.format,
        targetSeconds,
        dna: dna ? `${dna.dna.headline}\n${dna.dna.dimensions.map((d) => `${d.key}: ${d.direction}`).join("\n")}` : undefined,
        brandName: project.name,
      },
      { reason: `Storyboard for "${project.name}"`, projectId },
    );
    const { output: spec } = await runSkill<CreativeSpecDoc>(
      ctx,
      "production.spec-compile",
      { title: board.output.title, aspect: project.format, palette: project.chosenDirection.palette, shots: board.output.shots },
      { reason: "Compile storyboard into CreativeSpec", projectId, parentRunId: board.runId },
    );
    await layOut(ctx, projectId, spec);
    await update(ctx, projectId, { stage: advance(project.stage, "story") });
    refresh(slug, projectId);
    return { scenes: spec.scenes.length };
  });
}

/** STORY without AI: a three-scene template to fill in by hand. Text is marked as placeholder. */
export async function startBlankSpecAction(slug: string, projectId: string) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    const shot = (purpose: "hook" | "turn" | "cta", headline: string, duration: number) => ({
      purpose,
      duration,
      headline,
      layout: "center" as const,
      camera: "static",
      visual: "none",
      animation: purpose === "hook" ? "text-kinetic-scale" : "text-mask-reveal",
      background: "#141210",
      transition: purpose === "cta" ? null : "transition-mask-wipe",
      audio: "",
    });
    const { output: spec } = await runSkill<CreativeSpecDoc>(
      ctx,
      "production.spec-compile",
      {
        title: project.name,
        aspect: project.format,
        palette: project.chosenDirection?.palette ?? [],
        shots: [shot("hook", "[Your hook]", 2.5), shot("turn", "[The idea]", 3), shot("cta", "[Call to action]", 2.5)],
      },
      { reason: "Blank storyboard template", projectId },
    );
    await layOut(ctx, projectId, spec);
    await update(ctx, projectId, { stage: advance(project.stage, "story") });
    refresh(slug, projectId);
  });
}

export async function saveSpecAction(slug: string, projectId: string, spec: unknown) {
  return runAction(async () => {
    const { ctx } = await editable(slug, projectId);
    await layOut(ctx, projectId, creativeSpecSchema.parse(spec));
    return { savedAt: new Date().toISOString() };
  });
}

export async function qualityCheckAction(slug: string, projectId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const project = await getProject(ctx, projectId);
    if (!project.spec) throw new AppError("VALIDATION", "Nothing to check yet.");
    return (await runSkill<QualityReport>(ctx, "production.quality-control", { spec: project.spec }, { reason: "Quality check", projectId })).output;
  });
}

/** FINAL: save the piece as a reusable composition in the library. */
export async function saveCompositionAction(slug: string, projectId: string, name: string) {
  return runAction(async () => {
    const { ctx, project } = await editable(slug, projectId);
    if (!project.spec) throw new AppError("VALIDATION", "Nothing to save yet.");
    const title = z.string().trim().min(2, "Give it a name.").max(80).parse(name);
    const [row] = await ctx.db
      .insert(composition)
      .values({ organizationId: ctx.organization.id, projectId, name: title, description: project.chosenDirection?.premise ?? null, spec: project.spec, createdById: ctx.userId })
      .returning({ id: composition.id });
    await remember(ctx, "composition", row!.id, title, { projectId, scenes: project.spec.scenes.length, direction: project.chosenDirection?.title });
    await update(ctx, projectId, { stage: "final" });
    revalidatePath(`/w/${slug}`, "layout");
    return { id: row!.id };
  });
}

/** Library → reuse: start a new project from a saved composition. */
export async function reuseCompositionAction(slug: string, compositionId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { project: ["create"] });
    const [row] = await ctx.db.select().from(composition).where(and(eq(composition.id, compositionId), eq(composition.organizationId, ctx.organization.id)));
    if (!row) throw new AppError("NOT_FOUND", "Composition not found.");
    const { createProject } = await import("@/server/services/projects");
    const created = await createProject(ctx, { name: `${row.name} (copy)` });
    await update(ctx, created.id, { format: row.spec.aspect, idea: row.description, stage: "story" });
    await layOut(ctx, created.id, row.spec);
    revalidatePath(`/w/${slug}`, "layout");
    return { projectId: created.id };
  });
}

const newProjectSchema = z.object({
  name: z.string().trim().min(2, "Give it a name.").max(80),
  idea: z.string().trim().min(8, "Say a little more about the idea.").max(3000),
  format: z.enum(["9:16", "1:1", "4:5", "16:9"]),
  websiteUrl: z.string().trim().optional(),
});

/** CREATE: a new project starts from its idea. */
export async function createJourneyProjectAction(slug: string, input: z.input<typeof newProjectSchema>) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const data = newProjectSchema.parse(input);
    const { createProject } = await import("@/server/services/projects");
    const created = await createProject(ctx, { name: data.name, websiteUrl: data.websiteUrl || undefined });
    await update(ctx, created.id, { idea: data.idea, format: data.format, stage: "explore" });
    revalidatePath(`/w/${slug}`, "layout");
    return { projectId: created.id };
  });
}
