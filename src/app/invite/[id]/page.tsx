import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Logo } from "@/components/brand/logo";
import { AcceptInvitation } from "@/components/workspace/accept-invitation";
import { ROLE_META, primaryRole } from "@/lib/permissions";
import { db } from "@/server/db";
import { invitation, organization } from "@/server/db/schema";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=/invite/${id}`);

  const [invite] = await db
    .select({ email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, workspace: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, id))
    .limit(1);

  const valid = invite && invite.status === "pending" && invite.expiresAt > new Date();
  const wrongAccount = valid && invite.email.toLowerCase() !== session.user.email.toLowerCase();

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10 sm:py-8">
      <Logo className="text-[15px]" />
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6 py-16">
        {!valid ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">This invitation has expired</h1>
            <p className="text-sm text-muted-foreground">Ask whoever invited you to send a new one.</p>
            <Link href="/" className="text-sm underline-offset-4 hover:underline">Go to your workspace</Link>
          </>
        ) : wrongAccount ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Wrong account</h1>
            <p className="text-sm text-muted-foreground">
              This invitation is for <span className="text-foreground">{invite.email}</span>, but you&apos;re signed in as{" "}
              {session.user.email}. Sign out and sign in with the invited email.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="label-meta">Invitation</p>
              <h1 className="text-2xl font-semibold tracking-tight">Join {invite.workspace}</h1>
              <p className="text-sm text-muted-foreground">
                You&apos;ve been invited as {ROLE_META[primaryRole(invite.role ?? "viewer")].label.toLowerCase()}.{" "}
                {ROLE_META[primaryRole(invite.role ?? "viewer")].description}
              </p>
            </div>
            <AcceptInvitation invitationId={id} />
          </>
        )}
      </main>
    </div>
  );
}
