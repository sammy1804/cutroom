import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Dna, ExternalLink, Images, Megaphone } from "lucide-react";
import { ClaudeNotice } from "@/components/claude-notice";
import { DnaActions } from "@/components/creative/dna-actions";
import { DnaView } from "@/components/creative/dna-view";
import { MyAssets } from "@/components/library/my-assets";
import { ReferenceCapture, ReferenceGrid } from "@/components/library/references";
import { cn } from "@/lib/utils";
import { isClaudeConfigured } from "@/server/ai/claude";
import { latestJob } from "@/server/jobs/runner";
import { getCreativeDna, listAssets, listReferences } from "@/server/services/library";
import type { ResearchReport } from "@/server/agents/research";
import { NewCampaignDialog } from "@/components/campaigns/campaign-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-header";
import { ProjectSettingsMenu } from "@/components/projects/project-settings-menu";
import { CampaignStatusPill, ProjectSwatch } from "@/components/status";
import { can } from "@/lib/permissions";
import { relativeTime, shortDate } from "@/lib/format";
import { OBJECTIVES, PROJECT_COLORS } from "@/lib/validation";
import { AppError } from "@/server/errors";
import { getWorkspace } from "@/server/session";
import { listCampaigns } from "@/server/services/campaigns";
import { getProject } from "@/server/services/projects";

type Params = Promise<{ slug: string; projectId: string }>;

async function load(slug: string, projectId: string) {
  const ctx = await getWorkspace(slug);
  try {
    return { ctx, project: await getProject(ctx, projectId) };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, projectId } = await params;
  const { project } = await load(slug, projectId);
  return { title: project.name };
}

const TABS = [
  { id: "campaigns", label: "Campaigns" },
  { id: "references", label: "References" },
  { id: "dna", label: "CreativeDNA" },
  { id: "assets", label: "Assets" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: Promise<{ tab?: string }> }) {
  const { slug, projectId } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : "campaigns";
  const { ctx, project } = await load(slug, projectId);
  const campaigns = await listCampaigns(ctx, project.id);
  const base = `/w/${slug}/projects/${project.id}`;
  const canCreate = can(ctx.role, { campaign: ["create"] }) && project.status === "active";
  const canEditAssets = can(ctx.role, { asset: ["upload"] });

  return (
    <PageContainer className="space-y-8">
      <div className="space-y-4">
        <nav className="label-meta flex items-center gap-1.5" aria-label="Breadcrumb">
          <Link href={`/w/${slug}/projects`} className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <span className="truncate text-foreground/80">{project.name}</span>
        </nav>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <ProjectSwatch color={project.color} className="size-3.5" />
              <h1 className="truncate text-[28px] font-semibold tracking-tight sm:text-[34px]">{project.name}</h1>
              {project.status === "archived" && (
                <span className="rounded border px-1.5 py-0.5 text-[13px] text-muted-foreground uppercase">Archived</span>
              )}
            </div>
            {project.description && <p className="max-w-[65ch] text-sm text-muted-foreground">{project.description}</p>}
            {project.websiteUrl && (
              <a
                href={project.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
              >
                {project.websiteUrl.replace(/^https?:\/\//, "")}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canCreate && <NewCampaignDialog slug={slug} projectId={project.id} />}
            <ProjectSettingsMenu
              slug={slug}
              project={{
                id: project.id,
                name: project.name,
                description: project.description ?? "",
                websiteUrl: project.websiteUrl ?? "",
                color: project.color as (typeof PROJECT_COLORS)[number],
                status: project.status,
              }}
              permissions={{
                update: can(ctx.role, { project: ["update"] }),
                archive: can(ctx.role, { project: ["archive"] }),
                delete: can(ctx.role, { project: ["delete"] }),
              }}
            />
          </div>
        </header>
      </div>

      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" aria-label="Project sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "campaigns" ? base : `${base}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 border-transparent px-3 pb-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground",
              tab === t.id && "border-foreground font-medium text-foreground",
            )}
          >
            {t.label}
            {t.id === "campaigns" && <span className="tabular ml-2 rounded-full bg-muted px-1.5 font-mono text-xs">{campaigns.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "campaigns" && (
      <section className="space-y-3">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="No campaigns in this project"
            description="A campaign holds one brief and its deliverables: the channels, formats and, in upcoming phases, the scripts, generated media and renders."
            action={canCreate ? <NewCampaignDialog slug={slug} projectId={project.id} /> : undefined}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}/campaigns/${c.id}`}
                  className="flex h-full flex-col gap-4 rounded-lg bg-card shadow-card p-4 transition-colors hover:bg-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{OBJECTIVES.find((o) => o.id === c.objective)?.label}</p>
                    </div>
                    <CampaignStatusPill status={c.status} />
                  </div>
                  {c.brief && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.brief}</p>}
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1">
                      {c.aspectRatios.map((r) => (
                        <span key={r} className="rounded border px-1.5 py-0.5 text-[13px] text-muted-foreground">
                          {r}
                        </span>
                      ))}
                    </div>
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {c.dueDate ? `Due ${shortDate(c.dueDate)}` : relativeTime(c.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
      {tab === "references" && <ReferencesTab slug={slug} projectId={project.id} canEdit={canEditAssets} />}
      {tab === "dna" && <DnaTab slug={slug} projectId={project.id} canEdit={canEditAssets} />}
      {tab === "assets" && <AssetsTab slug={slug} projectId={project.id} projectName={project.name} canEdit={canEditAssets} />}
    </PageContainer>
  );
}

async function approvedNumbering(slug: string, projectId: string) {
  const ctx = await getWorkspace(slug);
  const approved = (await listReferences(ctx, { projectId, status: "approved", limit: 200 })).sort((a, b) => +a.createdAt - +b.createdAt);
  return new Map(approved.map((r, i) => [r.id, i + 1]));
}

async function ReferencesTab({ slug, projectId, canEdit }: { slug: string; projectId: string; canEdit: boolean }) {
  const ctx = await getWorkspace(slug);
  const [refs, numbers, research] = await Promise.all([
    listReferences(ctx, { projectId, limit: 200 }),
    approvedNumbering(slug, projectId),
    latestJob(ctx, { kind: "research", projectId }),
  ]);
  const leads = research?.status === "succeeded" ? ((research.output as unknown as ResearchReport).referenceLeads ?? []) : [];
  const summaries = refs.map((r) => ({ ...r, number: numbers.get(r.id) }));
  const approved = summaries.filter((r) => r.status === "approved").sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const review = summaries.filter((r) => r.status !== "approved");
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">
          The browser research agent opens approved pages, captures them and analyses their composition, colour, type and motion. References teach
          direction and are never used as production assets.
        </p>
      </div>
      <ClaudeNotice />
      {canEdit && <ReferenceCapture slug={slug} projectId={projectId} aiEnabled={isClaudeConfigured()} suggestions={leads} />}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Approved <span className="tabular ml-1 text-sm text-muted-foreground">{approved.length}</span>
        </h2>
        <ReferenceGrid slug={slug} canEdit={canEdit} references={approved} emptyText="Approve references you want the CreativeDNA to learn from." />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          To review <span className="tabular ml-1 text-sm text-muted-foreground">{review.length}</span>
        </h2>
        <ReferenceGrid slug={slug} canEdit={canEdit} references={review} emptyText="Captured references appear here, ranked by relevance to the brief." />
      </section>
    </div>
  );
}

async function DnaTab({ slug, projectId, canEdit }: { slug: string; projectId: string; canEdit: boolean }) {
  const ctx = await getWorkspace(slug);
  const [row, numbers] = await Promise.all([getCreativeDna(ctx, projectId), approvedNumbering(slug, projectId)]);
  const refs = row ? (await listReferences(ctx, { projectId, limit: 200 })).filter((r) => row.referenceIds.includes(r.id)) : [];
  return (
    <div className="space-y-8">
      <ClaudeNotice />
      <DnaActions slug={slug} projectId={projectId} hasDna={Boolean(row)} approvedCount={numbers.size} aiEnabled={isClaudeConfigured()} canEdit={canEdit} />
      {row ? (
        <DnaView slug={slug} dna={row.dna} updatedAt={row.updatedAt} refs={refs.map((r) => ({ id: r.id, title: r.title, imageKey: r.imageKey, number: numbers.get(r.id) ?? 0 }))} />
      ) : (
        <EmptyState
          icon={<Dna />}
          title="No CreativeDNA yet"
          description="Approve the references that feel right, then build the DNA. Claude explains what each reference teaches (typography, colour, motion, composition) and turns it into direction the whole campaign follows."
        />
      )}
    </div>
  );
}

async function AssetsTab({ slug, projectId, projectName, canEdit }: { slug: string; projectId: string; projectName: string; canEdit: boolean }) {
  const ctx = await getWorkspace(slug);
  const assets = await listAssets(ctx, { projectId });
  if (!assets.length) {
    return (
      <EmptyState
        icon={<Images />}
        title="No assets in this project"
        description="Find licence-checked photos, footage and audio, then add the ones that fit. Every asset keeps its licence record."
        action={
          <Link href={`/w/${slug}/library?tab=free&project=${projectId}`} className="text-sm font-medium text-tally underline-offset-4 hover:underline">
            Find free assets →
          </Link>
        }
      />
    );
  }
  return (
    <MyAssets
      slug={slug}
      canEdit={canEdit}
      assets={assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, usageStatus: a.usageStatus, storageKey: a.storageKey, externalUrl: a.externalUrl, thumbnailUrl: a.thumbnailUrl, rights: a.rights, projectName }))}
    />
  );
}
