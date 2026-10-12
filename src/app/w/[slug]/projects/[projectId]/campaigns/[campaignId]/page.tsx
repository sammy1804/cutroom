import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { CampaignDialog } from "@/components/campaigns/campaign-dialog";
import type { CampaignDraft } from "@/components/campaigns/campaign-fields";
import { PipelinePreview, type StageId, type StageState } from "@/components/campaigns/pipeline";
import { CreativeSpecPanel } from "@/components/campaigns/creative-spec";
import { ResearchPanel } from "@/components/campaigns/research-panel";
import { ClaudeNotice } from "@/components/claude-notice";
import { isClaudeConfigured } from "@/server/ai/claude";
import type { ResearchReport } from "@/lib/skill-types";
import { isActive, latestJob, recentJobs } from "@/server/jobs/runner";
import { getCreativeDna, listAssets, listReferences } from "@/server/services/library";
import { PageContainer } from "@/components/page-header";
import { ProjectSwatch } from "@/components/status";
import { can } from "@/lib/permissions";
import { relativeTime, shortDate } from "@/lib/format";
import { CHANNELS, OBJECTIVES } from "@/lib/validation";
import { AppError } from "@/server/errors";
import { getWorkspace } from "@/server/session";
import { getCampaign } from "@/server/services/campaigns";
import { getProject } from "@/server/services/projects";

type Params = Promise<{ slug: string; projectId: string; campaignId: string }>;

async function load(slug: string, projectId: string, campaignId: string) {
  const ctx = await getWorkspace(slug);
  try {
    const [project, campaign] = await Promise.all([getProject(ctx, projectId), getCampaign(ctx, campaignId)]);
    if (campaign.projectId !== project.id) notFound();
    return { ctx, project, campaign };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, projectId, campaignId } = await params;
  const { campaign, project } = await load(slug, projectId, campaignId);
  return { title: `${campaign.name} · ${project.name}` };
}

export default async function CampaignPage({ params }: { params: Params }) {
  const { slug, projectId, campaignId } = await params;
  const { ctx, project, campaign } = await load(slug, projectId, campaignId);
  const canEdit = can(ctx.role, { campaign: ["update"] });
  const draft: CampaignDraft & { id: string } = {
    id: campaign.id,
    name: campaign.name,
    objective: campaign.objective,
    brief: campaign.brief ?? "",
    audience: campaign.audience ?? "",
    channels: campaign.channels as CampaignDraft["channels"],
    aspectRatios: campaign.aspectRatios as CampaignDraft["aspectRatios"],
    dueDate: campaign.dueDate ?? "",
  };
  const [research, approvedRefs, dna, assets] = await Promise.all([
    latestJob(ctx, { kind: "research", campaignId: campaign.id }),
    listReferences(ctx, { projectId: project.id, status: "approved", limit: 1 }),
    getCreativeDna(ctx, project.id),
    listAssets(ctx, { projectId: project.id, status: ["approved", "in_use"] }),
  ]);
  const lastGoodResearch = research?.status === "succeeded" ? research : (await recentJobs(ctx, { kind: "research", projectId: project.id }, 10)).find((j) => j.campaignId === campaign.id && j.status === "succeeded") ?? null;
  const report = lastGoodResearch ? (lastGoodResearch.output as unknown as ResearchReport) : null;
  const projectBase = `/w/${slug}/projects/${project.id}`;
  const states: Partial<Record<StageId, StageState>> = {
    brief: campaign.brief ? "done" : "ready",
    research: report ? "done" : "ready",
    references: approvedRefs.length ? "done" : "ready",
    dna: dna ? "done" : "ready",
    assets: assets.length ? "done" : "ready",
    animation: campaign.creativeSpec.animations.length ? "done" : "ready",
  };
  const hrefs: Partial<Record<StageId, string>> = {
    research: "#research",
    references: `${projectBase}?tab=references`,
    dna: `${projectBase}?tab=dna`,
    assets: `/w/${slug}/library?tab=free&project=${project.id}`,
    animation: `/w/${slug}/library?tab=animations`,
  };
  const channelLabels = campaign.channels.map((id) => CHANNELS.find((c) => c.id === id)?.label ?? id);
  const deliverables = channelLabels.length * campaign.aspectRatios.length;

  return (
    <PageContainer className="space-y-8">
      <div className="space-y-4">
        <nav className="label-meta flex min-w-0 items-center gap-1.5" aria-label="Breadcrumb">
          <Link href={`/w/${slug}/projects`} className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <Link href={`/w/${slug}/projects/${project.id}`} className="flex min-w-0 items-center gap-1.5 hover:text-foreground">
            <ProjectSwatch color={project.color} className="size-2" />
            <span className="truncate">{project.name}</span>
          </Link>
        </nav>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground">
              {OBJECTIVES.find((o) => o.id === campaign.objective)?.label} campaign · updated {relativeTime(campaign.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canEdit && <CampaignDialog slug={slug} projectId={project.id} campaign={draft} />}
            <CampaignActions
              slug={slug}
              projectId={project.id}
              campaignId={campaign.id}
              status={campaign.status}
              permissions={{
                update: canEdit,
                archive: can(ctx.role, { campaign: ["archive"] }),
                delete: can(ctx.role, { campaign: ["delete"] }),
              }}
            />
          </div>
        </header>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Production pipeline</h2>
        <PipelinePreview states={states} hrefs={hrefs} />
      </section>

      <section id="research" className="scroll-mt-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Research</h2>
          <p className="text-[15px] text-muted-foreground">Claude researches the audience, competitors and platform trends for this brief, with sources.</p>
        </div>
        <ClaudeNotice />
        <ResearchPanel
          slug={slug}
          campaignId={campaign.id}
          report={report}
          activeJobId={isActive(research) ? research!.id : undefined}
          lastError={research?.status === "failed" ? research.error : null}
          ranAt={lastGoodResearch ? relativeTime(lastGoodResearch.finishedAt ?? lastGoodResearch.createdAt) : undefined}
          aiEnabled={isClaudeConfigured()}
          canRun={can(ctx.role, { job: ["create"] })}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Creative spec</h2>
          <p className="text-[15px] text-muted-foreground">
            The motion system for this campaign{dna ? `, following the CreativeDNA: “${dna.dna.headline}”` : ""}.
          </p>
        </div>
        <CreativeSpecPanel slug={slug} campaignId={campaign.id} animations={campaign.creativeSpec.animations} canEdit={canEdit} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Brief</h2>
          <div className="rounded-lg bg-card shadow-card p-5">
            {campaign.brief ? (
              <p className="max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap">{campaign.brief}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No brief yet. A clear brief makes everything downstream better: research, scripts and generated cuts all read from it.
              </p>
            )}
          </div>

          <h2 className="pt-4 text-lg font-semibold tracking-tight">
            Deliverables <span className="tabular ml-1 text-sm text-muted-foreground">{deliverables}</span>
          </h2>
          {deliverables === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Pick at least one channel and one format to define the deliverables.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="label-meta px-4 py-2.5 text-left font-medium">Channel</th>
                    {campaign.aspectRatios.map((r) => (
                      <th key={r} className="label-meta px-4 py-2.5 text-left font-medium">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {channelLabels.map((label) => (
                    <tr key={label}>
                      <td className="px-4 py-2.5 whitespace-nowrap">{label}</td>
                      {campaign.aspectRatios.map((r) => (
                        <td key={r} className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <span className="size-1.5 rounded-full border border-muted-foreground/50" /> Not started
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Details</h2>
          <dl className="divide-y rounded-lg border text-sm">
            {[
              ["Objective", OBJECTIVES.find((o) => o.id === campaign.objective)?.label],
              ["Audience", campaign.audience || "—"],
              ["Due", campaign.dueDate ? shortDate(campaign.dueDate) : "—"],
              ["Channels", channelLabels.join(", ") || "—"],
              ["Formats", campaign.aspectRatios.join(" · ") || "—"],
              ["Created", shortDate(campaign.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[88px_1fr] gap-3 px-4 py-2.5">
                <dt className="label-meta pt-0.5">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </PageContainer>
  );
}
