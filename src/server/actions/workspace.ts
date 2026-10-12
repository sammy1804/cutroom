"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/server/auth/server";
import { db } from "@/server/db";
import { runAction, unauthenticated } from "@/server/errors";
import { actionWorkspace, getSession } from "@/server/session";
import { createWorkspace, renameWorkspace } from "@/server/services/workspaces";
import { inviteSchema } from "@/lib/validation";
import { assertCan } from "@/server/services/context";
import { isRole } from "@/lib/permissions";
import { AppError } from "@/server/errors";

export async function createWorkspaceAction(input: { name: string }) {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw unauthenticated();
    return createWorkspace(auth, db, session.user.id, input);
  });
}

export async function renameWorkspaceAction(slug: string, input: { name: string }) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const result = await renameWorkspace(ctx, input);
    revalidatePath(`/w/${slug}`, "layout");
    return result;
  });
}

export async function inviteMemberAction(slug: string, input: { email: string; role: string }) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { invitation: ["create"] });
    const data = inviteSchema.parse(input);
    const invite = await auth.api.createInvitation({
      headers: await headers(),
      body: { email: data.email, role: data.role, organizationId: ctx.organization.id },
    });
    revalidatePath(`/w/${slug}/settings/members`);
    return { id: invite.id };
  });
}

export async function cancelInvitationAction(slug: string, invitationId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { invitation: ["cancel"] });
    await auth.api.cancelInvitation({ headers: await headers(), body: { invitationId } });
    revalidatePath(`/w/${slug}/settings/members`);
  });
}

export async function updateMemberRoleAction(slug: string, memberId: string, role: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { member: ["update"] });
    if (!isRole(role)) throw new AppError("VALIDATION", "Unknown role.");
    await auth.api.updateMemberRole({
      headers: await headers(),
      body: { memberId, role, organizationId: ctx.organization.id },
    });
    revalidatePath(`/w/${slug}/settings/members`);
  });
}

export async function removeMemberAction(slug: string, memberId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { member: ["delete"] });
    await auth.api.removeMember({
      headers: await headers(),
      body: { memberIdOrEmail: memberId, organizationId: ctx.organization.id },
    });
    revalidatePath(`/w/${slug}/settings/members`);
  });
}

export async function acceptInvitationAction(invitationId: string) {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw unauthenticated();
    const result = await auth.api.acceptInvitation({ headers: await headers(), body: { invitationId } });
    if (!result) throw new AppError("NOT_FOUND", "This invitation is no longer valid.");
    const org = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: result.invitation.organizationId },
    });
    return { slug: org?.slug ?? null };
  });
}
