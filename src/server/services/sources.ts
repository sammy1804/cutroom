import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { project, source } from "@/server/db/schema";
import { AppError, notFound } from "@/server/errors";
import { DEFAULT_SOURCES, isSameSite } from "@/lib/sources";
import { slugify } from "@/lib/slug";
import { assertCan, type WorkspaceContext } from "./context";

/** Copies any default sources the workspace doesn't have yet. Idempotent. */
export async function ensureSources(ctx: WorkspaceContext) {
  await ctx.db
    .insert(source)
    .values(
      DEFAULT_SOURCES.map((s) => ({
        organizationId: ctx.organization.id,
        key: s.key,
        name: s.name,
        url: s.url,
        type: s.type,
        role: s.role,
        purpose: s.purpose,
        accessMethod: s.accessMethod,
        rightsPolicy: s.rightsPolicy,
        apiProvider: s.apiProvider ?? null,
        enabled: s.role === "reference" ? true : (s.enabledByDefault ?? Boolean(s.requiresEnv && process.env[s.requiresEnv])),
      })),
    )
    .onConflictDoNothing();
}

export async function listSources(ctx: WorkspaceContext) {
  await ensureSources(ctx);
  return ctx.db
    .select()
    .from(source)
    .where(eq(source.organizationId, ctx.organization.id))
    .orderBy(asc(source.role), asc(source.name));
}

export async function setSourceEnabled(ctx: WorkspaceContext, id: string, enabled: boolean) {
  assertCan(ctx, { providers: ["manage"] });
  const [row] = await ctx.db
    .update(source)
    .set({ enabled })
    .where(and(eq(source.id, id), eq(source.organizationId, ctx.organization.id)))
    .returning({ id: source.id });
  if (!row) throw notFound("Source");
}

const customSourceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  url: z.string().trim().url("Enter a full URL, including https://"),
  type: z.enum(["DESIGN_REFERENCE", "MOTION_REFERENCE", "PHOTOGRAPHY", "VIDEO", "ILLUSTRATION", "TYPOGRAPHY", "3D", "TEXTURE", "ICON", "AUDIO"]),
  purpose: z.string().trim().min(2).max(200),
});

/** Custom sources are always reference-only: we can't verify a licence for an arbitrary site. */
export async function addReferenceSource(ctx: WorkspaceContext, input: unknown) {
  assertCan(ctx, { providers: ["manage"] });
  const data = customSourceSchema.parse(input);
  const [row] = await ctx.db
    .insert(source)
    .values({
      ...data,
      organizationId: ctx.organization.id,
      key: `custom-${slugify(data.name)}-${crypto.randomUUID().slice(0, 4)}`,
      role: "reference",
      accessMethod: "browser",
      rightsPolicy: "reference_only",
      enabled: true,
    })
    .returning();
  return row!;
}

/**
 * The BrowserResearchAgent may only open URLs on an enabled reference source,
 * or the website of a project in this workspace.
 */
export async function resolveApprovedSite(ctx: WorkspaceContext, url: string) {
  const sources = await listSources(ctx);
  const match = sources.find((s) => s.enabled && isSameSite(url, s.url));
  if (match) return { sourceId: match.id, name: match.name };

  const projects = await ctx.db
    .select({ websiteUrl: project.websiteUrl, name: project.name })
    .from(project)
    .where(eq(project.organizationId, ctx.organization.id));
  const own = projects.find((p) => p.websiteUrl && isSameSite(url, p.websiteUrl));
  if (own) return { sourceId: null, name: own.name };

  throw new AppError(
    "FORBIDDEN",
    "That site isn't approved for browsing. Add it in Settings → Sources, or use a project's own website.",
  );
}

export async function enabledAssetProviders(ctx: WorkspaceContext) {
  const sources = await listSources(ctx);
  return sources.filter((s) => s.enabled && s.role === "asset" && s.apiProvider).map((s) => s.apiProvider!);
}
