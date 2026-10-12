import { and, asc, count, eq } from "drizzle-orm";
import type { Auth } from "@/server/auth";
import type { Database } from "@/server/db/client";
import { invitation, member, organization, user } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { RESERVED_SLUGS, uniqueSlug } from "@/lib/slug";
import { workspaceSchema } from "@/lib/validation";
import { assertCan, type WorkspaceContext } from "./context";

export async function listWorkspacesForUser(db: Database, userId: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt));
}

/** Resolves a workspace by slug for a user, or null if it doesn't exist or they aren't a member. */
export async function findMembership(db: Database, userId: string, slug: string) {
  const [row] = await db
    .select({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
      },
      role: member.role,
    })
    .from(organization)
    .innerJoin(member, and(eq(member.organizationId, organization.id), eq(member.userId, userId)))
    .where(eq(organization.slug, slug))
    .limit(1);
  return row ?? null;
}

async function workspaceSlugTaken(db: Database, slug: string) {
  if (RESERVED_SLUGS.has(slug)) return true;
  const [row] = await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, slug));
  return Boolean(row);
}

export async function createWorkspace(auth: Auth, db: Database, userId: string, input: unknown) {
  const { name } = workspaceSchema.parse(input);
  const slug = await uniqueSlug(name, (s) => workspaceSlugTaken(db, s));
  const created = await auth.api.createOrganization({ body: { name, slug, userId } });
  if (!created) throw new AppError("INTERNAL", "Could not create the workspace.");
  return { id: created.id, slug: created.slug, name: created.name };
}

export async function renameWorkspace(ctx: WorkspaceContext, input: unknown) {
  assertCan(ctx, { organization: ["update"] });
  const { name } = workspaceSchema.parse(input);
  await ctx.db.update(organization).set({ name }).where(eq(organization.id, ctx.organization.id));
  return { name };
}

export async function listMembers(ctx: WorkspaceContext) {
  return ctx.db
    .select({
      id: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.organization.id))
    .orderBy(asc(member.createdAt));
}

export async function listPendingInvitations(ctx: WorkspaceContext) {
  return ctx.db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, ctx.organization.id), eq(invitation.status, "pending")))
    .orderBy(asc(invitation.createdAt));
}

export async function countMembers(ctx: WorkspaceContext) {
  const [row] = await ctx.db
    .select({ n: count() })
    .from(member)
    .where(eq(member.organizationId, ctx.organization.id));
  return row?.n ?? 0;
}
