import type { Metadata } from "next";
import Link from "next/link";
import { ClaudeNotice } from "@/components/claude-notice";
import { EmptyState } from "@/components/empty-state";
import { AnimationsPanel } from "@/components/library/animations-panel";
import { AssetSourcing } from "@/components/library/asset-sourcing";
import { LibraryTabs, LIBRARY_TABS, type LibraryTab } from "@/components/library/library-tabs";
import { MyAssets } from "@/components/library/my-assets";
import { CompositionGrid } from "@/components/library/compositions";
import { composition } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { ReferenceGrid } from "@/components/library/references";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { isClaudeConfigured } from "@/server/ai/claude";
import { getWorkspace } from "@/server/session";
import { listCampaignOptions } from "@/server/services/campaigns";
import { listAssets, listCustomPresets, listReferences } from "@/server/services/library";
import { listProjects } from "@/server/services/projects";
import { Images } from "lucide-react";
import { cn } from "@/lib/utils";
import { publishedTemplates } from "@/lib/library/registry";
import { TEMPLATE_CATEGORIES } from "@/lib/library/taxonomy";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; job?: string; project?: string; kind?: string; view?: string; cat?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  // Older links keep working.
  const legacy: Record<string, { tab: string; view?: string }> = { compositions: { tab: "templates" }, open: { tab: "assets", view: "mine" }, free: { tab: "assets", view: "stock" } };
  const moved = sp.tab ? legacy[sp.tab] : undefined;
  const wanted = moved?.tab ?? sp.tab;
  const view = moved?.view ?? sp.view ?? "mine";
  const tab = (LIBRARY_TABS.some((t) => t.id === wanted) ? wanted : "templates") as LibraryTab;
  const ctx = await getWorkspace(slug);
  const canEdit = can(ctx.role, { asset: ["upload"] });
  const aiEnabled = isClaudeConfigured();
  const base = `/w/${slug}/library`;
  const projects = (await listProjects(ctx)).map((p) => ({ id: p.id, name: p.name }));
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  let body: React.ReactNode = null;
  if (tab === "templates") {
    const rows = await ctx.db.select().from(composition).where(eq(composition.organizationId, ctx.organization.id)).orderBy(desc(composition.createdAt)).limit(60);
    const builtIn = publishedTemplates();
    const cat = TEMPLATE_CATEGORIES.some((c) => c.id === sp.cat) ? sp.cat : null;
    body = (
      <div className="space-y-8">
        <nav className="flex flex-wrap gap-1.5" aria-label="Template categories">
          <Link href={`${base}?tab=templates`} aria-current={!cat ? "page" : undefined} className={cn("rounded-full border px-3.5 py-1.5 text-[15px] hover:bg-hover", !cat && "border-foreground bg-foreground text-background hover:bg-foreground")}>
            All
          </Link>
          {TEMPLATE_CATEGORIES.map((c) => (
            <Link key={c.id} href={`${base}?tab=templates&cat=${c.id}`} title={c.hint} aria-current={cat === c.id ? "page" : undefined} className={cn("rounded-full border px-3.5 py-1.5 text-[15px] text-muted-foreground hover:bg-hover hover:text-foreground", cat === c.id && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")}>
              {c.label}
            </Link>
          ))}
        </nav>
        {builtIn.filter((t) => !cat || t.meta.category === cat).length === 0 && (
          <div className="rounded-xl border border-dashed p-6">
            <p className="font-medium">Cutroom templates are in production</p>
            <p className="mt-1 max-w-[70ch] text-[15px] text-muted-foreground">
              Each one is built, rendered and reviewed against a ten-point quality bar before it appears here. The first set: Minimal Product Launch, Cinematic Product
              Reveal, Editorial Campaign, Paper Cut Story, Stop Motion Collage, Kinetic Typography Film, App Launch, Architecture Film, Data Story and Brand Manifesto.
            </p>
          </div>
        )}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Your workspace&apos;s templates</h2>
          <CompositionGrid slug={slug} canCreate={can(ctx.role, { project: ["create"] })} items={rows.map((r) => ({ id: r.id, name: r.name, description: r.description, spec: r.spec }))} />
        </section>
      </div>
    );
  } else if (tab === "animations" || tab === "transitions") {
    const [customs, campaigns] = await Promise.all([listCustomPresets(ctx), listCampaignOptions(ctx)]);
    body = (
      <AnimationsPanel
        key={tab}
        mode={tab}
        slug={slug}
        customPresets={customs.map((c) => ({ id: c.id, basePresetId: c.basePresetId, name: c.name, params: c.params }))}
        campaigns={campaigns}
        canEdit={can(ctx.role, { campaign: ["update"] })}
        aiEnabled={aiEnabled}
      />
    );
  } else if (tab === "assets") {
    const views = [
      { id: "mine", label: "Ours" },
      { id: "stock", label: "Stock photos & video" },
    ];
    let inner: React.ReactNode;
    if (view === "stock") {
      inner = <AssetSourcing slug={slug} projects={projects} defaultProjectId={sp.project} defaultMediaType="image" initialJobId={sp.job} aiEnabled={aiEnabled} canEdit={canEdit} />;
    } else {
      inner = <SavedAssets slug={slug} canEdit={canEdit} projectNames={projectNames} />;
    }
    body = (
      <div className="space-y-6">
        <nav className="flex gap-1 rounded-lg bg-muted p-1 text-[14px] w-fit" aria-label="Asset sources">
          {views.map((v) => (
            <Link key={v.id} href={`${base}?tab=assets&view=${v.id}`} aria-current={view === v.id ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground", view === v.id && "bg-background font-medium text-foreground shadow-sm")}>
              {v.label}
            </Link>
          ))}
        </nav>
        {inner}
      </div>
    );
  } else if (tab === "audio") {
    body = (
      <>
        <SavedAssets slug={slug} kind="audio" canEdit={canEdit} projectNames={projectNames} />
        <AssetSourcing slug={slug} projects={projects} defaultProjectId={sp.project} defaultMediaType="audio" initialJobId={sp.job} aiEnabled={aiEnabled} canEdit={canEdit} />
      </>
    );
  } else if (tab === "references") {
    const refs = await listReferences(ctx, { limit: 200 });
    body = (
      <ReferenceGrid
        slug={slug}
        canEdit={canEdit}
        references={refs.map((r) => ({ ...r, number: undefined }))}
        emptyText="No references yet. Open a project and capture pages from approved sources; they'll collect here across every project."
      />
    );
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        eyebrow={ctx.organization.name}
        title="Library"
        description="Templates to start from, the motion they're built with, and the assets and references around them."
      />
      <LibraryTabs base={base} active={tab} />
      {(tab === "animations" || tab === "transitions" || (tab === "assets" && view === "stock") || tab === "audio") && <ClaudeNotice />}
      {body}
    </PageContainer>
  );
}

async function SavedAssets({ slug, kind, canEdit, projectNames }: { slug: string; kind?: "audio"; canEdit: boolean; projectNames: Map<string, string> }) {
  const ctx = await getWorkspace(slug);
  const assets = await listAssets(ctx, { kind });
  if (assets.length === 0) {
    if (kind) return null;
    return (
      <EmptyState
        icon={<Images />}
        title="No assets yet"
        description="Usable media lives here with its licence. Find free, licence-checked photos, footage and audio, then add the ones you like to a project."
        action={
          <Button asChild>
            <Link href={`/w/${slug}/library?tab=free`}>Find free assets</Link>
          </Button>
        }
      />
    );
  }
  return (
    <section className="space-y-3">
      {kind && <h2 className="font-medium">Saved audio</h2>}
      <MyAssets
        slug={slug}
        canEdit={canEdit}
        assets={assets.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          usageStatus: a.usageStatus,
          storageKey: a.storageKey,
          externalUrl: a.externalUrl,
          thumbnailUrl: a.thumbnailUrl,
          rights: a.rights,
          projectName: a.projectId ? (projectNames.get(a.projectId) ?? null) : null,
        }))}
      />
    </section>
  );
}
