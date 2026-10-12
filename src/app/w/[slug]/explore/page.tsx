import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ClaudeNotice } from "@/components/claude-notice";
import { ExploreResearch } from "@/components/explore/explore-research";
import { ReferenceCapture, ReferenceGrid } from "@/components/library/references";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { relativeTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { ResearchReport } from "@/lib/skill-types";
import { isClaudeConfigured } from "@/server/ai/claude";
import { job } from "@/server/db/schema";
import { listReferences } from "@/server/services/library";
import { getWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; report?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await getWorkspace(slug);
  const aiEnabled = isClaudeConfigured();
  const canEdit = can(ctx.role, { job: ["create"] });
  const [runs, refs] = await Promise.all([
    ctx.db
      .select()
      .from(job)
      .where(and(eq(job.organizationId, ctx.organization.id), eq(job.kind, "research"), isNull(job.projectId)))
      .orderBy(desc(job.createdAt))
      .limit(12),
    listReferences(ctx, { search: sp.q, limit: 60 }),
  ]);
  const open = runs.find((r) => r.id === sp.report && r.status === "succeeded");
  const report = open ? (open.output as unknown as ResearchReport) : null;

  return (
    <PageContainer className="space-y-12">
      <PageHeader title="Explore" description="Research the market, capture references from approved sites, and build up what the studio knows." />
      <ClaudeNotice />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Research</h2>
        {canEdit && <ExploreResearch slug={slug} aiEnabled={aiEnabled} />}
        {runs.length > 0 && (
          <ul className="divide-y">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/w/${slug}/explore?report=${r.id}`} className="flex items-baseline justify-between gap-4 rounded-md px-2 py-3 hover:bg-hover" aria-current={r.id === sp.report ? "true" : undefined}>
                  <span className="truncate text-[15px]">{String((r.input as { question?: string }).question ?? "Research")}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">{r.status === "succeeded" ? relativeTime(r.createdAt) : r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {report && (
          <article className="space-y-5 rounded-lg bg-card p-6 shadow-card">
            <p className="text-[16px] leading-relaxed">{report.summary}</p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="label-meta">Trends</h3>
                <ul className="space-y-2 text-[15px]">{report.trends.map((t) => <li key={t.trend}><span className="font-medium">{t.trend}</span> <span className="text-muted-foreground">{t.evidence}</span></li>)}</ul>
              </div>
              <div className="space-y-2">
                <h3 className="label-meta">Competitors</h3>
                <ul className="space-y-2 text-[15px]">{report.competitors.map((c) => <li key={c.name}><span className="font-medium">{c.name}</span> <span className="text-muted-foreground">{c.approach}</span></li>)}</ul>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="label-meta">Visual directions</h3>
              <ul className="list-disc space-y-1 pl-5 text-[15px]">{report.visualDirections.map((v) => <li key={v}>{v}</li>)}</ul>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Sources ({report.sources.length})</summary>
              <ul className="mt-2 space-y-1 text-sm">{report.sources.map((s) => <li key={s.url}><a className="text-muted-foreground hover:text-foreground" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a></li>)}</ul>
            </details>
          </article>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">References</h2>
        {canEdit && <ReferenceCapture slug={slug} aiEnabled={aiEnabled} />}
        <form className="max-w-sm" role="search">
          <label htmlFor="ref-q" className="sr-only">
            Search references
          </label>
          <Input id="ref-q" name="q" defaultValue={sp.q} placeholder="Search by style, mood or technique" className="h-9" />
        </form>
        <ReferenceGrid slug={slug} canEdit={can(ctx.role, { asset: ["upload"] })} references={refs.map((r) => ({ ...r, number: undefined }))} emptyText={sp.q ? `No references match “${sp.q}”.` : "No references yet. Capture a page from an approved source above."} />
      </section>

      <section className="space-y-2 rounded-lg bg-muted p-6">
        <h2 className="text-lg font-semibold">Market creative map</h2>
        <p className="max-w-[65ch] text-[15px] text-muted-foreground">
          Not built yet. It will map what a category is doing, what&apos;s repetitive, what works and which territories are open, from authorised social and campaign data (Phase 4).
        </p>
      </section>
    </PageContainer>
  );
}
