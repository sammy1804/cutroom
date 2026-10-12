import type { Metadata } from "next";
import { InviteForm, MemberRow, PendingInvitationRow } from "@/components/settings/members";
import { SettingsSection } from "@/components/settings/section";
import { can, primaryRole } from "@/lib/permissions";
import { publicEnv } from "@/env";
import { getWorkspace } from "@/server/session";
import { listMembers, listPendingInvitations } from "@/server/services/workspaces";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const canManage = can(ctx.role, { member: ["update"] });
  const canInvite = can(ctx.role, { invitation: ["create"] });
  const [members, invitations] = await Promise.all([listMembers(ctx), canInvite ? listPendingInvitations(ctx) : []]);
  const myRole = primaryRole(ctx.role);

  return (
    <div className="space-y-6">
      {canInvite && (
        <SettingsSection title="Invite teammates" description="They'll get a link to join this workspace with the role you choose.">
          <InviteForm slug={slug} allowAdmin={myRole === "owner" || myRole === "admin"} />
        </SettingsSection>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Members <span className="tabular ml-1 text-sm text-muted-foreground">{members.length}</span>
        </h2>
        <ul className="divide-y rounded-lg border">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              slug={slug}
              member={{ ...m, role: primaryRole(m.role) }}
              isSelf={m.userId === ctx.userId}
              canManage={canManage && m.userId !== ctx.userId && (primaryRole(m.role) !== "owner" || myRole === "owner")}
              canAssignOwner={myRole === "owner"}
            />
          ))}
        </ul>
      </section>

      {canInvite && invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Pending invitations <span className="tabular ml-1 text-sm text-muted-foreground">{invitations.length}</span>
          </h2>
          <ul className="divide-y rounded-lg border">
            {invitations.map((i) => (
              <PendingInvitationRow key={i.id} slug={slug} invitation={i} link={`${publicEnv.appUrl}/invite/${i.id}`} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
