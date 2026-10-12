import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { listWorkspacesForUser } from "@/server/services/workspaces";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const workspaces = await listWorkspacesForUser(db, user.id);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex items-center justify-between">
        <Logo className="text-[15px]" />
        {workspaces.length > 0 && (
          <Link href={`/w/${workspaces[0]!.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
            Back to {workspaces[0]!.name}
          </Link>
        )}
      </div>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-8 py-16">
        <div className="space-y-2">
          <p className="label-meta">New workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {workspaces.length ? "Create another workspace" : `Set up your studio, ${firstName}`}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A workspace holds your team, your brands and every campaign you produce for them. Agencies
            usually create one per client group; in-house teams need just one.
          </p>
        </div>
        <CreateWorkspaceForm />
      </main>
    </div>
  );
}
