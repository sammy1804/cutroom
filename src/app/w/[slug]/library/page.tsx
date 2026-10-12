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
import { ReferenceReels } from "@/components/library/reference-reels";
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

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; job?: string; project?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab = (LIBRARY_TABS.some((t) => t.id === sp.tab) ? sp.tab : "animations") as LibraryTab;
  const ctx = await getWorkspace(slug);
  const canEdit = can(ctx.role, { asset: ["upload"] });
  const aiEnabled = isClaudeConfigured();
  const base = `/w/${slug}/library`;
  const projects = (await listProjects(ctx)).map((p) => ({ id: p.id, name: p.name }));
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  let body: React.ReactNode = null;
  if (tab === "animations") {
    const [customs, campaigns] = await Promise.all([listCustomPresets(ctx), listCampaignOptions(ctx)]);
    body = (
      <>
      <ReferenceReels />
      <AnimationsPanel
        slug={slug}
        customPresets={customs.map((c) => ({ id: c.id, basePresetId: c.basePresetId, name: c.name, params: c.params }))}
        campaigns={campaigns}
        canEdit={can(ctx.role, { campaign: ["update"] })}
        aiEnabled={aiEnabled}
      />
      </>
    );
  } else if (tab === "compositions") {
    const rows = await ctx.db.select().from(composition).where(eq(composition.organizationId, ctx.organization.id)).orderBy(desc(composition.createdAt)).limit(60);
    body = <CompositionGrid slug={slug} canCreate={can(ctx.role, { project: ["create"] })} items={rows.map((r) => ({ id: r.id, name: r.name, description: r.description, spec: r.spec }))} />;
  } else if (tab === "free" || tab === "audio") {
    body = (
      <>
        {tab === "audio" && <SavedAssets slug={slug} kind="audio" canEdit={canEdit} projectNames={projectNames} />}
        <AssetSourcing
          key={tab}
          slug={slug}
          projects={projects}
          defaultProjectId={sp.project}
          defaultMediaType={tab === "audio" ? "audio" : "image"}
          initialJobId={sp.job}
          aiEnabled={aiEnabled}
          canEdit={canEdit}
        />
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
  } else {
    body = <SavedAssets slug={slug} canEdit={canEdit} projectNames={projectNames} />;
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        eyebrow={ctx.organization.name}
        title="Library"
        description="Animations, templates, usable assets and visual references, shared across every project."
      />
      <LibraryTabs base={base} active={tab} />
      {(tab === "animations" || tab === "free" || tab === "audio") && <ClaudeNotice />}
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
