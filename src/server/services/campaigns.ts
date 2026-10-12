import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { campaign, project } from "@/server/db/schema";
import { notFound } from "@/server/errors";
import { campaignSchema, campaignStatusSchema } from "@/lib/validation";
import { assertCan, type WorkspaceContext } from "./context";
import { getProject } from "./projects";

const scoped = (ctx: WorkspaceContext, id: string) =>
  and(eq(campaign.id, id), eq(campaign.organizationId, ctx.organization.id));

async function touchProject(ctx: WorkspaceContext, projectId: string) {
  await ctx.db.update(project).set({ updatedAt: new Date() }).where(eq(project.id, projectId));
}

export async function listCampaigns(ctx: WorkspaceContext, projectId: string) {
  return ctx.db
    .select()
    .from(campaign)
    .where(and(eq(campaign.organizationId, ctx.organization.id), eq(campaign.projectId, projectId)))
    .orderBy(asc(sql`${campaign.status} = 'archived'`), desc(campaign.updatedAt));
}

/** Campaigns across the workspace that aren't archived, newest activity first. */
export async function listRecentCampaigns(ctx: WorkspaceContext, limit = 8) {
  return ctx.db
    .select({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      channels: campaign.channels,
      dueDate: campaign.dueDate,
      updatedAt: campaign.updatedAt,
      project: { id: project.id, name: project.name, color: project.color },
    })
    .from(campaign)
    .innerJoin(project, eq(campaign.projectId, project.id))
    .where(and(eq(campaign.organizationId, ctx.organization.id), ne(campaign.status, "archived")))
    .orderBy(desc(campaign.updatedAt))
    .limit(limit);
}

export async function getCampaign(ctx: WorkspaceContext, id: string) {
  const [row] = await ctx.db.select().from(campaign).where(scoped(ctx, id)).limit(1);
  if (!row) throw notFound("Campaign");
  return row;
}

export async function createCampaign(ctx: WorkspaceContext, projectId: string, input: unknown) {
  assertCan(ctx, { campaign: ["create"] });
  const data = campaignSchema.parse(input);
  await getProject(ctx, projectId); // ensures the project belongs to this workspace
  const [created] = await ctx.db
    .insert(campaign)
    .values({ ...data, projectId, organizationId: ctx.organization.id, createdById: ctx.userId })
    .returning();
  await touchProject(ctx, projectId);
  return created!;
}

export async function updateCampaign(ctx: WorkspaceContext, id: string, input: unknown) {
  assertCan(ctx, { campaign: ["update"] });
  const data = campaignSchema.parse(input);
  const [updated] = await ctx.db.update(campaign).set(data).where(scoped(ctx, id)).returning();
  if (!updated) throw notFound("Campaign");
  await touchProject(ctx, updated.projectId);
  return updated;
}

export async function setCampaignStatus(ctx: WorkspaceContext, id: string, status: unknown) {
  const next = campaignStatusSchema.parse(status);
  assertCan(ctx, { campaign: [next === "archived" ? "archive" : "update"] });
  const [updated] = await ctx.db.update(campaign).set({ status: next }).where(scoped(ctx, id)).returning();
  if (!updated) throw notFound("Campaign");
  await touchProject(ctx, updated.projectId);
  return updated;
}

export async function deleteCampaign(ctx: WorkspaceContext, id: string) {
  assertCan(ctx, { campaign: ["delete"] });
  const [deleted] = await ctx.db.delete(campaign).where(scoped(ctx, id)).returning({ id: campaign.id });
  if (!deleted) throw notFound("Campaign");
}

/** Campaigns that animations can be applied to, with their project names. */
export async function listCampaignOptions(ctx: WorkspaceContext) {
  return ctx.db
    .select({ id: campaign.id, name: campaign.name, projectName: project.name, projectId: project.id })
    .from(campaign)
    .innerJoin(project, eq(campaign.projectId, project.id))
    .where(and(eq(campaign.organizationId, ctx.organization.id), ne(campaign.status, "archived")))
    .orderBy(desc(campaign.updatedAt))
    .limit(100);
}
