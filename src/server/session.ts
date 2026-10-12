import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/server/auth/server";
import { db } from "@/server/db";
import type { WorkspaceContext } from "@/server/services/context";
import { findMembership } from "@/server/services/workspaces";
import { notFound as notFoundError, unauthenticated } from "@/server/errors";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** For pages: redirects to sign-in when there is no session. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/** For pages: 404s when the workspace doesn't exist or the user isn't a member. */
export const getWorkspace = cache(async (slug: string): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const membership = await findMembership(db, user.id, slug);
  if (!membership) notFound();
  return { db, userId: user.id, organization: membership.organization, role: membership.role };
});

/** For server actions: throws an AppError instead of redirecting. */
export async function actionWorkspace(slug: string): Promise<WorkspaceContext> {
  const session = await getSession();
  if (!session) throw unauthenticated();
  const membership = await findMembership(db, session.user.id, slug);
  if (!membership) throw notFoundError("Workspace");
  return { db, userId: session.user.id, organization: membership.organization, role: membership.role };
}
