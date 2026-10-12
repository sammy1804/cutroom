import { and, count, desc, eq, sql } from "drizzle-orm";
import { campaign, project } from "@/server/db/schema";
import { notFound } from "@/server/errors";
import { RESERVED_SLUGS, uniqueSlug } from "@/lib/slug";
import { projectSchema } from "@/lib/validation";
import { assertCan, type WorkspaceContext } from "./context";

const scoped = (ctx: WorkspaceContext, id: string) =>
  and(eq(project.id, id), eq(project.organizationId, ctx.organization.id));

export async function listProjects(ctx: WorkspaceContext, opts: { status?: "active" | "archived" } = {}) {
  const status = opts.status ?? "active";
  return ctx.db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      color: project.color,
      status: project.status,
      updatedAt: project.updatedAt,
      campaignCount: sql<number>`count(${campaign.id})::int`,
      activeCampaignCount: sql<number>`(count(${campaign.id}) filter (where ${campaign.status} in ('in_production', 'in_review')))::int`,
    })
    .from(project)
    .leftJoin(campaign, eq(campaign.projectId, project.id))
    .where(and(eq(project.organizationId, ctx.organization.id), eq(project.status, status)))
    .groupBy(project.id)
    .orderBy(desc(project.updatedAt));
}

export async function getProject(ctx: WorkspaceContext, id: string) {
  const [row] = await ctx.db.select().from(project).where(scoped(ctx, id)).limit(1);
  if (!row) throw notFound("Project");
  return row;
}

export async function createProject(ctx: WorkspaceContext, input: unknown) {
  assertCan(ctx, { project: ["create"] });
  const data = projectSchema.parse(input);
  const slug = await uniqueSlug(data.name, async (s) => {
    if (RESERVED_SLUGS.has(s)) return true;
    const [hit] = await ctx.db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.organizationId, ctx.organization.id), eq(project.slug, s)));
    return Boolean(hit);
  });
  const [created] = await ctx.db
    .insert(project)
    .values({ ...data, slug, organizationId: ctx.organization.id, createdById: ctx.userId })
    .returning();
  return created!;
}

export async function updateProject(ctx: WorkspaceContext, id: string, input: unknown) {
  assertCan(ctx, { project: ["update"] });
  const data = projectSchema.parse(input);
  const [updated] = await ctx.db.update(project).set(data).where(scoped(ctx, id)).returning();
  if (!updated) throw notFound("Project");
  return updated;
}

export async function setProjectArchived(ctx: WorkspaceContext, id: string, archived: boolean) {
  assertCan(ctx, { project: ["archive"] });
  const [updated] = await ctx.db
    .update(project)
    .set({ status: archived ? "archived" : "active", archivedAt: archived ? new Date() : null })
    .where(scoped(ctx, id))
    .returning({ id: project.id });
  if (!updated) throw notFound("Project");
}

export async function deleteProject(ctx: WorkspaceContext, id: string) {
  assertCan(ctx, { project: ["delete"] });
  const [deleted] = await ctx.db.delete(project).where(scoped(ctx, id)).returning({ id: project.id });
  if (!deleted) throw notFound("Project");
}

export async function getWorkspaceStats(ctx: WorkspaceContext) {
  const orgId = ctx.organization.id;
  const [projects] = await ctx.db
    .select({ n: count() })
    .from(project)
    .where(and(eq(project.organizationId, orgId), eq(project.status, "active")));
  const byStatus = await ctx.db
    .select({ status: campaign.status, n: count() })
    .from(campaign)
    .where(eq(campaign.organizationId, orgId))
    .groupBy(campaign.status);
  const statusCount = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0;
  return {
    projects: projects?.n ?? 0,
    drafts: statusCount("draft"),
    inProduction: statusCount("in_production"),
    inReview: statusCount("in_review"),
    approved: statusCount("approved"),
  };
}
