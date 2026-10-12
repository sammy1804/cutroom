"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { z as Z } from "zod";
import type { animationSearchOutput } from "@skills/motion/animation-search/skill";
import type { routeSchema } from "@skills/orchestration/command-route/skill";
import type { sourcingOutput } from "@skills/production/asset-search/skill";
import type { dnaSchema } from "@skills/creative/creative-dna/skill";
import { runSkill } from "@/server/skills/runtime";
import { creativeDna, project as projectTable, reference } from "@/server/db/schema";
import { AppError, runAction } from "@/server/errors";
import { getJob, startJob } from "@/server/jobs/runner";
import { actionWorkspace } from "@/server/session";
import { getCampaign } from "@/server/services/campaigns";
import { assertCan, type WorkspaceContext } from "@/server/services/context";
import {
  addAnimationToSpec,
  deleteAsset,
  deleteCustomPreset,
  deleteReference,
  getCreativeDna,
  listMemory,
  listReferences,
  remember,
  removeAnimationFromSpec,
  saveCustomPreset,
  saveSourcedAsset,
  setAssetStatus,
  setReferenceStatus,
} from "@/server/services/library";
import { getProject } from "@/server/services/projects";
import { addReferenceSource, enabledAssetProviders, setSourceEnabled } from "@/server/services/sources";
import { getPreset } from "@/lib/animations/presets";
import { CHANNELS, OBJECTIVES } from "@/lib/validation";

type SourcingResult = Z.infer<typeof sourcingOutput>;
type AnimationSearchResult = Z.infer<typeof animationSearchOutput>;
import type { AnimationRole } from "@/lib/creative-types";

const refresh = (slug: string) => revalidatePath(`/w/${slug}`, "layout");

/* Jobs */

export async function jobStatusAction(slug: string, jobId: string) {
  return runAction(async () => {
    const j = await getJob(await actionWorkspace(slug), jobId);
    return { status: j.status, progress: j.progress, error: j.error, output: j.status === "succeeded" ? j.output : null };
  });
}

/* Research Brain */

/** EXPLORE: research any topic, outside a project. */
export async function exploreResearchAction(slug: string, question: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const q = z.string().trim().min(5, "Ask a fuller question.").max(1000).parse(question);
    const j = await startJob(ctx, { kind: "research", input: { question: q } }, async (report) => {
      const { output } = await runSkill(ctx, "research.web-research", { question: q }, { reason: `Explore: ${q.slice(0, 80)}`, onProgress: report });
      return output as Record<string, unknown>;
    });
    refresh(slug);
    return { jobId: j.id };
  });
}

export async function startResearchAction(slug: string, campaignId: string, focus?: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const campaign = await getCampaign(ctx, campaignId);
    const project = await getProject(ctx, campaign.projectId);
    const context = [
      `Brand / product: ${project.name}${project.websiteUrl ? ` (${project.websiteUrl})` : ""}`,
      project.description && `About: ${project.description}`,
      `Campaign: ${campaign.name}; objective: ${OBJECTIVES.find((o) => o.id === campaign.objective)?.label}`,
      campaign.brief && `Brief: ${campaign.brief}`,
      campaign.audience && `Audience: ${campaign.audience}`,
      `Channels: ${campaign.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(", ") || "not chosen"}; formats: ${campaign.aspectRatios.join(", ") || "any"}`,
    ]
      .filter(Boolean)
      .join("\n");
    const question = focus?.trim() || `Research this campaign: audience, competitors, trends and visual references for ${project.name}.`;
    const j = await startJob(ctx, { kind: "research", input: { focus: focus ?? null }, projectId: project.id, campaignId }, async (report) => {
      const { output } = await runSkill(ctx, "research.web-research", { question, context }, { reason: `Research for campaign "${campaign.name}"`, projectId: project.id, onProgress: report });
      return output as Record<string, unknown>;
    });
    refresh(slug);
    return { jobId: j.id };
  });
}

/* BrowserResearchAgent */

export async function captureReferenceAction(slug: string, input: { url: string; projectId?: string; campaignId?: string; brief?: string }) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const url = z.string().trim().url("Enter a full URL, including https://").parse(input.url);
    if (!input.projectId) {
      const brief = input.brief?.trim() || "General visual research for the studio's reference library.";
      const j = await startJob(ctx, { kind: "reference_capture", input: { url } }, async (report, jobId) =>
        (await runSkill<{ referenceIds: string[] }>(ctx, "research.visual-reference-capture", { url, brief, projectId: null, campaignId: null, jobId }, { reason: `Capture ${url}`, onProgress: report })).output,
      );
      refresh(slug);
      return { jobId: j.id };
    }
    const project = await getProject(ctx, input.projectId);
    const campaign = input.campaignId ? await getCampaign(ctx, input.campaignId) : null;
    const brief = [project.name, project.description, campaign && `Campaign: ${campaign.name}. ${campaign.brief ?? ""}`].filter(Boolean).join("\n");
    const j = await startJob(ctx, { kind: "reference_capture", input: { url }, projectId: project.id, campaignId: campaign?.id }, async (report, jobId) =>
      (await runSkill<{ referenceIds: string[] }>(ctx, "research.visual-reference-capture", { url, brief, projectId: project.id, campaignId: campaign?.id ?? null, jobId }, { reason: `Capture ${url}`, projectId: project.id, onProgress: report })).output,
    );
    refresh(slug);
    return { jobId: j.id };
  });
}

export async function setReferenceStatusAction(slug: string, id: string, status: "approved" | "rejected" | "pending") {
  return runAction(async () => {
    await setReferenceStatus(await actionWorkspace(slug), id, status);
    refresh(slug);
  });
}

export async function deleteReferenceAction(slug: string, id: string) {
  return runAction(async () => {
    await deleteReference(await actionWorkspace(slug), id);
    refresh(slug);
  });
}

/* CreativeDNA */

export async function buildCreativeDnaAction(slug: string, projectId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const project = await getProject(ctx, projectId);
    const refs = await listReferences(ctx, { projectId, status: "approved", limit: 24 });
    if (refs.length < 2) throw new AppError("VALIDATION", "Approve at least two references first.");
    const memory = (await listMemory(ctx, 40)).filter((m) => m.kind !== "reference");
    const j = await startJob(ctx, { kind: "creative_dna", input: { referenceIds: refs.map((r) => r.id) }, projectId }, async (report) => {
      await report(15);
      const { output } = await runSkill<Z.infer<typeof dnaSchema>>(
        ctx,
        "creative.creative-dna",
        {
          projectName: project.name,
          projectDescription: project.description,
          direction: project.chosenDirection ? `${project.chosenDirection.title}: ${project.chosenDirection.premise}` : undefined,
          references: refs.map((r) => ({ id: r.id, title: r.title, url: r.url, analysis: r.analysis })),
          memory: memory.map((m) => ({ kind: m.kind, title: m.title, note: m.note })),
        },
        { reason: `Build CreativeDNA for ${project.name}`, projectId },
      );
      const dna = output;
      const valid = new Set(refs.map((r) => r.id));
      dna.dimensions = dna.dimensions.map((d) => ({ ...d, evidence: d.evidence.filter((id) => valid.has(id)) }));
      dna.learnedFrom = dna.learnedFrom.filter((l) => valid.has(l.referenceId));
      dna.suggestedAnimations = dna.suggestedAnimations.filter((id) => getPreset(id));
      await ctx.db
        .insert(creativeDna)
        .values({ projectId, organizationId: ctx.organization.id, dna, referenceIds: refs.map((r) => r.id) })
        .onConflictDoUpdate({ target: creativeDna.projectId, set: { dna, referenceIds: refs.map((r) => r.id), updatedAt: new Date() } });
      return { headline: dna.headline };
    });
    refresh(slug);
    return { jobId: j.id };
  });
}

export async function approveDirectionAction(slug: string, projectId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { project: ["update"] });
    const row = await getCreativeDna(ctx, projectId);
    if (!row) throw new AppError("NOT_FOUND", "Build the CreativeDNA first.");
    await remember(ctx, "direction", projectId, row.dna.headline, { dimensions: row.dna.dimensions.map((d) => `${d.key}: ${d.direction}`) });
    refresh(slug);
  });
}

/* AssetSourcingAgent */

const sourcingInput = z.object({
  requirement: z.string().trim().min(3, "Describe what you need.").max(600),
  mediaType: z.enum(["image", "video", "audio"]).optional(),
  aspectRatio: z.string().optional(),
  projectId: z.string().optional(),
  campaignId: z.string().optional(),
});

export async function startAssetSearchAction(slug: string, input: z.input<typeof sourcingInput>) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { job: ["create"] });
    const data = sourcingInput.parse(input);
    if (!(await enabledAssetProviders(ctx)).length) throw new AppError("VALIDATION", "No asset sources are enabled. Turn one on in Settings → Sources.");
    const direction = data.projectId ? (await getCreativeDna(ctx, data.projectId))?.dna.headline : undefined;
    const j = await startJob(ctx, { kind: "asset_search", input: data, projectId: data.projectId, campaignId: data.campaignId }, async (report) => {
      const { output } = await runSkill(ctx, "production.asset-search", { requirement: data.requirement, mediaType: data.mediaType, aspectRatio: data.aspectRatio, direction }, { reason: `Find assets: ${data.requirement.slice(0, 80)}`, projectId: data.projectId, onProgress: report });
      return output as Record<string, unknown>;
    });
    return { jobId: j.id };
  });
}

/** Saves a candidate from a finished search. Rights come from the stored job output, never the client. */
export async function saveCandidateAction(slug: string, input: { jobId: string; index: number; approve: boolean; projectId?: string }) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const j = await getJob(ctx, input.jobId);
    const result = j.output as unknown as SourcingResult | null;
    const candidate = result?.candidates?.[input.index];
    if (j.kind !== "asset_search" || !candidate) throw new AppError("NOT_FOUND", "That search result is no longer available.");
    const projectId = input.projectId ?? j.projectId ?? null;
    if (projectId) await getProject(ctx, projectId);
    const row = await saveSourcedAsset(ctx, candidate, { projectId, campaignId: j.campaignId, approve: input.approve, jobId: j.id });
    refresh(slug);
    return { id: row.id };
  });
}

export async function setAssetStatusAction(slug: string, id: string, status: "approved" | "rejected" | "candidate") {
  return runAction(async () => {
    await setAssetStatus(await actionWorkspace(slug), id, status);
    refresh(slug);
  });
}

export async function deleteAssetAction(slug: string, id: string) {
  return runAction(async () => {
    await deleteAsset(await actionWorkspace(slug), id);
    refresh(slug);
  });
}

/* Animation Library */

async function animationContext(ctx: WorkspaceContext, projectId?: string) {
  const lines: string[] = [];
  if (projectId) {
    const [p] = await ctx.db.select().from(projectTable).where(and(eq(projectTable.id, projectId), eq(projectTable.organizationId, ctx.organization.id)));
    if (p) lines.push(`Project: ${p.name}${p.description ? ` — ${p.description}` : ""}`);
    const dna = await getCreativeDna(ctx, projectId);
    if (dna) lines.push(`CreativeDNA: ${dna.dna.headline}\n${dna.dna.dimensions.map((d) => `- ${d.key}: ${d.direction}`).join("\n")}`);
    const refs = await ctx.db
      .select()
      .from(reference)
      .where(and(eq(reference.projectId, projectId), eq(reference.status, "approved")))
      .orderBy(asc(reference.createdAt))
      .limit(12);
    if (refs.length) {
      lines.push(
        "Approved references, numbered as the team sees them:\n" +
          refs.map((r, i) => `Reference ${String(i + 1).padStart(2, "0")}: ${r.title}. Motion: ${r.analysis?.motion ?? "n/a"}. Learnings: ${r.analysis?.learnings.join("; ") ?? ""}`).join("\n"),
      );
    }
  }
  const approvedMotion = (await listMemory(ctx, 30)).filter((m) => m.kind === "animation" || m.kind === "transition");
  if (approvedMotion.length) lines.push(`Animations this company has approved before: ${approvedMotion.map((m) => m.title).join(", ")}`);
  return lines.join("\n\n");
}

export async function searchAnimationsAction(slug: string, query: string, opts: { projectId?: string } = {}) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const q = z.string().trim().min(2, "Describe the feel you want.").max(400).parse(query);
    return (await runSkill<AnimationSearchResult>(ctx, "motion.animation-search", { query: q, context: (await animationContext(ctx, opts.projectId)) || undefined }, { reason: `Animation search: ${q.slice(0, 80)}`, projectId: opts.projectId })).output;
  });
}

export async function saveCustomPresetAction(slug: string, input: { basePresetId: string; name: string; description?: string; params: Record<string, unknown> }) {
  return runAction(async () => {
    const row = await saveCustomPreset(await actionWorkspace(slug), input);
    refresh(slug);
    return { id: row.id };
  });
}

export async function deleteCustomPresetAction(slug: string, id: string) {
  return runAction(async () => {
    await deleteCustomPreset(await actionWorkspace(slug), id);
    refresh(slug);
  });
}

export async function approveAnimationAction(slug: string, input: { subjectId: string; name: string; presetId: string; params: Record<string, unknown> }) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { asset: ["upload"] });
    const preset = getPreset(input.presetId);
    if (!preset) throw new AppError("VALIDATION", "Unknown preset.");
    await remember(ctx, preset.category === "transition" ? "transition" : "animation", input.subjectId, input.name, { presetId: input.presetId, params: input.params });
    refresh(slug);
  });
}

export async function applyAnimationAction(slug: string, campaignId: string, input: { presetId: string; role: AnimationRole; params: Record<string, unknown>; customPresetId?: string; name?: string }) {
  return runAction(async () => {
    await addAnimationToSpec(await actionWorkspace(slug), campaignId, input);
    refresh(slug);
  });
}

export async function removeSpecAnimationAction(slug: string, campaignId: string, specId: string) {
  return runAction(async () => {
    await removeAnimationFromSpec(await actionWorkspace(slug), campaignId, specId);
    refresh(slug);
  });
}

/* Source Registry */

export async function setSourceEnabledAction(slug: string, id: string, enabled: boolean) {
  return runAction(async () => {
    await setSourceEnabled(await actionWorkspace(slug), id, enabled);
    refresh(slug);
  });
}

export async function addSourceAction(slug: string, input: { name: string; url: string; type: string; purpose: string }) {
  return runAction(async () => {
    await addReferenceSource(await actionWorkspace(slug), input);
    refresh(slug);
  });
}

/* AI command bar */

export type CommandResult =
  | { kind: "animations"; query: string; result: AnimationSearchResult }
  | { kind: "assets"; query: string; jobId: string; projectId: string | null }
  | { kind: "references"; query: string; items: { id: string; title: string; url: string; imageKey: string | null; projectId: string | null; status: string }[] }
  | { kind: "research"; jobId: string; campaignId: string; projectId: string }
  | { kind: "navigate"; href: string; label: string }
  | { kind: "answer"; text: string };

export async function commandAction(slug: string, input: string, where: { projectId?: string; campaignId?: string }) {
  return runAction<CommandResult>(async () => {
    const ctx = await actionWorkspace(slug);
    const text = z.string().trim().min(2).max(600).parse(input);
    const campaign = where.campaignId ? await getCampaign(ctx, where.campaignId).catch(() => null) : null;
    const projectId = campaign?.projectId ?? where.projectId;
    const project = projectId ? await getProject(ctx, projectId).catch(() => null) : null;
    const context = [project ? `project "${project.name}"` : "workspace overview", campaign && `campaign "${campaign.name}"`].filter(Boolean).join(", ");

    const route = (await runSkill<Z.infer<typeof routeSchema>>(ctx, "orchestration.command-route", { text, where: context }, { reason: "Command bar", projectId: project?.id })).output;
    switch (route.intent) {
      case "animations":
        return {
          kind: "animations",
          query: route.query,
          result: (await runSkill<AnimationSearchResult>(ctx, "motion.animation-search", { query: route.query, context: (await animationContext(ctx, project?.id)) || undefined }, { reason: "Command bar: animations", projectId: project?.id })).output,
        };
      case "assets": {
        const res = await startAssetSearchAction(slug, {
          requirement: route.query,
          mediaType: route.mediaType === "any" ? undefined : route.mediaType,
          aspectRatio: campaign?.aspectRatios[0],
          projectId: project?.id,
          campaignId: campaign?.id,
        });
        if (!res.ok) throw new AppError(res.code, res.message);
        return { kind: "assets", query: route.query, jobId: res.data.jobId, projectId: project?.id ?? null };
      }
      case "references": {
        const items = await listReferences(ctx, { search: route.query, limit: 12 });
        return { kind: "references", query: route.query, items: items.map((r) => ({ id: r.id, title: r.title, url: r.url, imageKey: r.imageKey, projectId: r.projectId, status: r.status })) };
      }
      case "research": {
        if (!campaign) return { kind: "answer", text: "Open a campaign first; research runs against its brief." };
        const res = await startResearchAction(slug, campaign.id, route.query);
        if (!res.ok) throw new AppError(res.code, res.message);
        return { kind: "research", jobId: res.data.jobId, campaignId: campaign.id, projectId: campaign.projectId };
      }
      case "creative_dna":
        if (!project) return { kind: "answer", text: "Open a project to see or rebuild its CreativeDNA." };
        return { kind: "navigate", href: `/w/${slug}/projects/${project.id}?tab=dna`, label: `Open ${project.name}'s CreativeDNA` };
      default:
        return { kind: "answer", text: route.answer || "I couldn't map that to a library. Try asking for an animation, asset, reference or research." };
    }
  });
}
