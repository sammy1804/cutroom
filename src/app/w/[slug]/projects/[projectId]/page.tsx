import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Dna, ExternalLink, Megaphone } from "lucide-react";
import { ClaudeNotice } from "@/components/claude-notice";
import { DnaActions } from "@/components/creative/dna-actions";
import { DnaView } from "@/components/creative/dna-view";
import { ReferenceCapture, ReferenceGrid } from "@/components/library/references";
import { cn } from "@/lib/utils";
import { DirectionsPanel } from "@/components/journey/directions-panel";
import { IdeaForm } from "@/components/journey/idea-form";
import { SpecWorkbench } from "@/components/journey/spec-workbench";
import { StoryStart } from "@/components/journey/story-start";
import { ResearchPanel } from "@/components/campaigns/research-panel";
import { JOURNEY, stageIndex, stageInfo, type JourneyStage } from "@/lib/journey";
import { storageUrl } from "@/lib/drag";
import { isActive, recentJobs } from "@/server/jobs/runner";
import { isClaudeConfigured } from "@/server/ai/claude";
import { getCreativeDna, listAssets, listReferences } from "@/server/services/library";
import type { ResearchReport } from "@/lib/skill-types";
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

/** Old ?tab= links map onto journey stages. */
const LEGACY_TAB: Record<string, JourneyStage> = { references: "explore", dna: "direction", assets: "design", campaigns: "final" };

export default async function ProjectPage({ params, searchParams }: { params: Params; searchParams: Promise<{ tab?: string; stage?: string }> }) {
  const { slug, projectId } = await params;
  const sp = await searchParams;
  const { ctx, project } = await load(slug, projectId);
  const requested = sp.stage ?? (sp.tab ? LEGACY_TAB[sp.tab] : undefined);
  const stage: JourneyStage = JOURNEY.some((j) => j.id === requested) ? (requested as JourneyStage) : project.stage;
  const campaigns = await listCampaigns(ctx, project.id);
  const base = `/w/${slug}/projects/${project.id}`;
  const canCreate = can(ctx.role, { campaign: ["create"] }) && project.status === "active";
  const canEditProject = can(ctx.role, { project: ["update"] });

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

      <JourneyNav base={base} current={project.stage} viewing={stage} />

      <section className="space-y-6" aria-labelledby="stage-question">
        <div className="space-y-1">
          <p className="label-meta">
            {String(stageIndex(stage) + 1).padStart(2, "0")} · {stageInfo(stage).label}
          </p>
          <h2 id="stage-question" className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {stageInfo(stage).question}
          </h2>
        </div>
        <StagePanel slug={slug} stage={stage} project={project} canEdit={canEditProject} />
      </section>

      {stage === "final" && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Campaign deliverables</h2>
            {canCreate && <NewCampaignDialog slug={slug} projectId={project.id} />}
          </div>
      <section className="space-y-3">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="No campaigns in this project"
            description="A campaign holds one brief and its deliverables: the channels, formats and, in upcoming phases, the scripts, generated media and renders."
            
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
        </section>
      )}
    </PageContainer>
  );
}

async function approvedNumbering(slug: string, projectId: string) {
  const ctx = await getWorkspace(slug);
  const approved = (await listReferences(ctx, { projectId, status: "approved", limit: 200 })).sort((a, b) => +a.createdAt - +b.createdAt);
  return new Map(approved.map((r, i) => [r.id, i + 1]));
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

function JourneyNav({ base, current, viewing }: { base: string; current: string; viewing: JourneyStage }) {
  const reached = stageIndex(current);
  return (
    <nav aria-label="Project journey" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max items-center gap-1">
        {JOURNEY.map((step, i) => {
          const done = i < reached;
          const isView = step.id === viewing;
          return (
            <li key={step.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className={cn("h-px w-4 sm:w-6", i <= reached ? "bg-tally" : "bg-border")} />}
              <Link
                href={`${base}?stage=${step.id}`}
                aria-current={isView ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[15px] transition-colors hover:bg-hover",
                  isView && "bg-foreground text-background hover:bg-foreground",
                  !isView && i <= reached && "text-foreground",
                  !isView && i > reached && "text-muted-foreground",
                )}
              >
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-semibold", isView ? "bg-background text-foreground" : done ? "bg-tally text-tally-foreground" : i === reached ? "ring-2 ring-tally" : "ring-1 ring-border")}>
                  {i + 1}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type ProjectRow = Awaited<ReturnType<typeof getProject>>;

async function StagePanel({ slug, stage, project, canEdit }: { slug: string; stage: JourneyStage; project: ProjectRow; canEdit: boolean }) {
  const ctx = await getWorkspace(slug);
  const aiEnabled = isClaudeConfigured();
  const next = (to: JourneyStage, label: string) => (
    <Link href={`/w/${slug}/projects/${project.id}?stage=${to}`} className="inline-flex items-center gap-1.5 text-[15px] font-medium text-tally underline-offset-4 hover:underline">
      {label} →
    </Link>
  );

  switch (stage) {
    case "idea":
      return <IdeaForm slug={slug} projectId={project.id} canEdit={canEdit} initial={{ idea: project.idea ?? "", audience: project.audience ?? "", format: project.format }} />;

    case "explore": {
      if (!project.idea) return <p className="text-[15px] text-muted-foreground">Write the idea first. {next("idea", "Go to Idea")}</p>;
      const jobs = await recentJobs(ctx, { kind: "research", projectId: project.id }, 10);
      const ideaJobs = jobs.filter((j) => !j.campaignId);
      const latest = ideaJobs[0] ?? null;
      const good = ideaJobs.find((j) => j.status === "succeeded") ?? null;
      return (
        <div className="space-y-10">
          <ClaudeNotice />
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">Research</h3>
            <ResearchPanel
              slug={slug}
              projectId={project.id}
              report={good ? (good.output as unknown as ResearchReport) : null}
              activeJobId={isActive(latest) ? latest!.id : undefined}
              lastError={latest?.status === "failed" ? latest.error : null}
              ranAt={good ? relativeTime(good.finishedAt ?? good.createdAt) : undefined}
              aiEnabled={aiEnabled}
              canRun={canEdit}
            />
          </div>
          <ReferencesSection slug={slug} projectId={project.id} canEdit={canEdit} leads={good ? ((good.output as unknown as ResearchReport).referenceLeads ?? []) : []} />
          {next("direction", "Next: choose a direction")}
        </div>
      );
    }

    case "direction": {
      if (!project.idea) return <p className="text-[15px] text-muted-foreground">Write the idea first. {next("idea", "Go to Idea")}</p>;
      const approved = await listReferences(ctx, { projectId: project.id, status: "approved", limit: 200 });
      return (
        <div className="space-y-12">
          <ClaudeNotice />
          <DirectionsPanel slug={slug} projectId={project.id} directions={project.directions} chosenId={project.chosenDirection?.id ?? null} canEdit={canEdit} aiEnabled={aiEnabled} approvedRefs={approved.length} />
          <details className="group rounded-lg bg-muted/60 p-5" open={approved.length >= 2}>
            <summary className="cursor-pointer text-[16px] font-semibold">CreativeDNA from references</summary>
            <div className="mt-6">
              <DnaTab slug={slug} projectId={project.id} canEdit={canEdit} />
            </div>
          </details>
        </div>
      );
    }

    case "story":
    case "design":
    case "motion":
    case "final": {
      if (!project.spec) {
        return (
          <div className="space-y-4">
            <ClaudeNotice />
            <p className="max-w-[65ch] text-[16px] text-muted-foreground">
              {project.chosenDirection ? `Direction: “${project.chosenDirection.title}”. ` : ""}Draft a storyboard with AI from the idea and direction, or start from a blank three-scene template and write it yourself.
            </p>
            <StoryStart slug={slug} projectId={project.id} hasDirection={Boolean(project.chosenDirection)} aiEnabled={aiEnabled} canEdit={canEdit} />
          </div>
        );
      }
      const images = (await listAssets(ctx, { projectId: project.id, kind: "image", status: ["approved", "in_use"] }))
        .map((a) => ({ id: a.id, name: a.name, url: storageUrl(a.storageKey) ?? a.externalUrl ?? "" }))
        .filter((a) => a.url);
      const following: Record<string, [JourneyStage, string] | null> = { story: ["design", "Next: design"], design: ["motion", "Next: motion"], motion: ["final", "Next: final"], final: null };
      const nextStep = following[stage];
      return (
        <div className="space-y-6">
          {stage === "story" && <StoryStart slug={slug} projectId={project.id} hasDirection={Boolean(project.chosenDirection)} aiEnabled={aiEnabled} canEdit={canEdit} redraft />}
          {stage === "design" && (
            <p className="text-[15px] text-muted-foreground">
              Pick colours and type, then place images.{" "}
              <Link href={`/w/${slug}/library?tab=free&project=${project.id}`} className="text-tally underline-offset-4 hover:underline">
                Find licence-checked images
              </Link>{" "}
              and add them to this project to use them here.
            </p>
          )}
          <SpecWorkbench key={stage} slug={slug} projectId={project.id} initial={project.spec} mode={stage} images={images} canEdit={canEdit} />
          {nextStep && next(nextStep[0], nextStep[1])}
        </div>
      );
    }
  }
}

async function ReferencesSection({ slug, projectId, canEdit, leads }: { slug: string; projectId: string; canEdit: boolean; leads: { url: string; why: string }[] }) {
  const ctx = await getWorkspace(slug);
  const [refs, numbers] = await Promise.all([listReferences(ctx, { projectId, limit: 200 }), approvedNumbering(slug, projectId)]);
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

