import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/server/db";
import { getWorkspace, requireUser } from "@/server/session";
import { listProjects } from "@/server/services/projects";
import { listWorkspacesForUser } from "@/server/services/workspaces";
import { can } from "@/lib/permissions";
import { isClaudeConfigured } from "@/server/ai/claude";

/** Agent jobs run after the response (next/server `after`) and need more than the default time. */
export const maxDuration = 300;

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const ctx = await getWorkspace(slug);
  const [workspaces, projects] = await Promise.all([listWorkspacesForUser(db, user.id), listProjects(ctx)]);

  return (
    <AppShell
      workspace={{ ...ctx.organization, role: ctx.role }}
      workspaces={workspaces}
      user={{ name: user.name, email: user.email, image: user.image ?? null }}
      pinnedProjects={projects.slice(0, 6).map((p) => ({ id: p.id, name: p.name, color: p.color }))}
      canCreateProject={can(ctx.role, { project: ["create"] })}
      aiEnabled={isClaudeConfigured()}
    >
      {children}
    </AppShell>
  );
}
