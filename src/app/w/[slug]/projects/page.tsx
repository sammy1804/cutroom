import type { Metadata } from "next";
import Link from "next/link";
import { Archive, FolderPlus, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ProjectSwatch } from "@/components/status";
import { Button } from "@/components/ui/button";
import { ImportBoardButton } from "@/components/projects/import-board";
import { can } from "@/lib/permissions";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getWorkspace } from "@/server/session";
import { listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Create" };

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const view = (await searchParams).view === "archived" ? "archived" : "active";
  const ctx = await getWorkspace(slug);
  const projects = await listProjects(ctx, { status: view });
  const base = `/w/${slug}`;
  const canCreate = can(ctx.role, { project: ["create"] });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow={ctx.organization.name}
        title="Create"
        description="Every project moves from idea to final piece: explore, choose a direction, shape the story, design, animate."
        actions={
          canCreate && (
            <div className="flex gap-2">
              <ImportBoardButton slug={slug} />
              <Button asChild>
                <Link href={`${base}/projects/new`}>
                  <Plus data-icon="inline-start" /> New project
                </Link>
              </Button>
            </div>
          )
        }
      />

      <nav className="flex gap-1 border-b" aria-label="Project status">
        {(["active", "archived"] as const).map((v) => (
          <Link
            key={v}
            href={v === "active" ? `${base}/projects` : `${base}/projects?view=archived`}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent px-2.5 pb-2 text-sm text-muted-foreground capitalize hover:text-foreground",
              view === v && "border-foreground font-medium text-foreground",
            )}
          >
            {v}
          </Link>
        ))}
      </nav>

      {projects.length === 0 ? (
        view === "active" ? (
          <EmptyState
            icon={<FolderPlus />}
            title="No projects yet"
            description="Create a project for each brand or product. Campaigns, briefs and later every generated asset live inside it."
            action={
              canCreate && (
                <Button asChild>
                  <Link href={`${base}/projects/new`}>
                    <Plus data-icon="inline-start" /> New project
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <EmptyState icon={<Archive />} title="Nothing archived" description="Archived projects are kept here with their campaigns intact." />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="label-meta px-4 py-2.5 font-medium">Project</th>
                <th className="label-meta hidden px-4 py-2.5 font-medium md:table-cell">Campaigns</th>
                <th className="label-meta hidden px-4 py-2.5 font-medium sm:table-cell">Active</th>
                <th className="label-meta px-4 py-2.5 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((p) => (
                <tr key={p.id} className="group relative transition-colors hover:bg-hover">
                  <td className="max-w-0 px-4 py-3">
                    <Link href={`${base}/projects/${p.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <ProjectSwatch color={p.color} className="size-3" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        {p.description && <span className="block truncate text-xs text-muted-foreground">{p.description}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="tabular hidden px-4 py-3 text-[13px] text-muted-foreground md:table-cell">{p.campaignCount}</td>
                  <td className="tabular hidden px-4 py-3 font-mono text-xs sm:table-cell">
                    {p.activeCampaignCount > 0 ? <span className="text-tally">{p.activeCampaignCount}</span> : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap text-muted-foreground">{relativeTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
