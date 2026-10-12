import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FolderPlus, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { PipelinePreview } from "@/components/campaigns/pipeline";
import { CampaignStatusPill, ProjectSwatch } from "@/components/status";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { relativeTime, shortDate } from "@/lib/format";
import { CHANNELS } from "@/lib/validation";
import { getWorkspace, requireUser } from "@/server/session";
import { listRecentCampaigns } from "@/server/services/campaigns";
import { getWorkspaceStats, listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, ctx] = await Promise.all([requireUser(), getWorkspace(slug)]);
  const [stats, projects, campaigns] = await Promise.all([
    getWorkspaceStats(ctx),
    listProjects(ctx),
    listRecentCampaigns(ctx),
  ]);
  const base = `/w/${slug}`;
  const canCreate = can(ctx.role, { project: ["create"] });

  const newProject = canCreate && (
    <Button asChild>
      <Link href={`${base}/projects/new`}>
        <Plus data-icon="inline-start" /> New project
      </Link>
    </Button>
  );

  if (projects.length === 0) {
    return (
      <PageContainer className="space-y-10">
        <PageHeader eyebrow={ctx.organization.name} title={`Welcome, ${user.name.split(" ")[0]}`} />
        <EmptyState
          icon={<FolderPlus />}
          title="Start with a project"
          description="A project is a brand or product you make content for. Inside it you'll plan campaigns, and in upcoming phases research, generate and edit the videos for them."
          action={newProject}
        >
          <PipelinePreview className="mt-6 w-full" />
        </EmptyState>
      </PageContainer>
    );
  }

  const strip = [
    { label: "Projects", value: stats.projects },
    { label: "Drafts", value: stats.drafts },
    { label: "In production", value: stats.inProduction, accent: true },
    { label: "In review", value: stats.inReview },
    { label: "Approved", value: stats.approved },
  ];

  return (
    <PageContainer className="space-y-10">
      <PageHeader eyebrow={ctx.organization.name} title="Overview" actions={newProject} />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-5">
        {strip.map((item) => (
          <div key={item.label} className="flex flex-col justify-between gap-3 bg-background px-4 py-4 last:col-span-2 md:px-5 md:last:col-span-1">
            <dt className="label-meta flex items-center gap-1.5 whitespace-nowrap">
              {item.accent && <span className="size-1.5 rounded-full bg-tally" />}
              {item.label}
            </dt>
            <dd className="tabular text-3xl font-semibold tracking-tight">{item.value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Campaigns in flight</h2>
          <span className="label-meta">Recently updated</span>
        </div>
        {campaigns.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            No campaigns yet. Open a project to plan its first campaign.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}/projects/${c.project.id}/campaigns/${c.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-hover lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_7rem_6rem]"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{c.name}</span>
                  <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground max-lg:order-3">
                    <ProjectSwatch color={c.project.color} />
                    <span className="truncate">{c.project.name}</span>
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground lg:block">
                    {c.channels.length
                      ? c.channels.map((id) => CHANNELS.find((ch) => ch.id === id)?.label ?? id).join(" · ")
                      : "No channels yet"}
                  </span>
                  <span className="justify-self-end lg:justify-self-start">
                    <CampaignStatusPill status={c.status} />
                  </span>
                  <span className="tabular text-right text-[13px] text-muted-foreground max-lg:order-4">
                    {c.dueDate ? `Due ${shortDate(c.dueDate)}` : relativeTime(c.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
          <Link href={`${base}/projects`} className="-my-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-hover hover:text-foreground">
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              href={`${base}/projects/${p.id}`}
              className="group relative flex flex-col gap-6 overflow-hidden rounded-lg bg-card shadow-card p-4 transition-colors hover:bg-hover"
            >
              <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${p.color}, transparent 70%)` }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <ProjectSwatch color={p.color} />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {p.description ?? "No description"}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                <span className="tabular">
                  {p.campaignCount} campaign{p.campaignCount === 1 ? "" : "s"}
                  {p.activeCampaignCount > 0 && <span className="text-tally"> · {p.activeCampaignCount} active</span>}
                </span>
                <span>{relativeTime(p.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
