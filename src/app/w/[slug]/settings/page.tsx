import type { Metadata } from "next";
import { DeleteWorkspace, WorkspaceNameForm } from "@/components/settings/general-forms";
import { SettingsSection } from "@/components/settings/section";
import { can } from "@/lib/permissions";
import { getWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

export default async function GeneralSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  return (
    <div className="space-y-6">
      <WorkspaceNameForm slug={slug} name={ctx.organization.name} canEdit={can(ctx.role, { organization: ["update"] })} />
      <SettingsSection title="Workspace URL" description="The address teammates use to reach this workspace.">
        <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
          <span className="text-muted-foreground">/w/</span>
          {ctx.organization.slug}
        </div>
      </SettingsSection>
      {can(ctx.role, { organization: ["delete"] }) && (
        <DeleteWorkspace organizationId={ctx.organization.id} name={ctx.organization.name} />
      )}
    </div>
  );
}
