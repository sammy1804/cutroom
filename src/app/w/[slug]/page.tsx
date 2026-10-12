import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, AudioLines, Bookmark, Clapperboard, Images, Layers, Megaphone, Plus, Wand2 } from "lucide-react";
import { BrainStart } from "@/components/brain/brain-start";
import { PageContainer } from "@/components/page-header";
import { ProjectSwatch } from "@/components/status";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { stageInfo, stageIndex, JOURNEY } from "@/lib/journey";
import { can } from "@/lib/permissions";
import { isClaudeConfigured } from "@/server/ai/claude";
import { project } from "@/server/db/schema";
import { getWorkspace, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Home" };

const SHELVES = [
  { label: "Animations", href: "library?tab=animations", icon: Wand2 },
  { label: "Templates", href: "library?tab=compositions", icon: Layers },
  { label: "References", href: "library?tab=references", icon: Bookmark },
  { label: "Assets", href: "library?tab=assets", icon: Images },
  { label: "Audio", href: "library?tab=audio", icon: AudioLines },
  { label: "Campaigns", href: "projects", icon: Megaphone },
];

export default async function HomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, ctx] = await Promise.all([requireUser(), getWorkspace(slug)]);
  const recent = await ctx.db
    .select({ id: project.id, name: project.name, color: project.color, stage: project.stage, idea: project.idea, updatedAt: project.updatedAt })
    .from(project)
    .where(eq(project.organizationId, ctx.organization.id))
    .orderBy(desc(project.updatedAt))
    .limit(6);
  const base = `/w/${slug}`;
  const canCreate = can(ctx.role, { project: ["create"] });

  return (
    <PageContainer className="max-w-[920px] space-y-14">
      <section className="space-y-6 pt-4 sm:pt-10">
        <p className="label-meta">Hi {user.name.split(" ")[0]}</p>
        <h1 className="text-[36px] leading-tight font-bold tracking-[-0.015em] sm:text-[48px]">What are you making?</h1>
        <BrainStart slug={slug} aiEnabled={isClaudeConfigured()} />
        {canCreate && (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link href={`${base}/projects/new`}>
                <Plus data-icon="inline-start" /> New project
              </Link>
            </Button>
            <span className="text-[15px] text-muted-foreground">or describe an idea above and brainstorm it first.</span>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Recent projects</h2>
          {recent.length > 0 && (
            <Link href={`${base}/projects`} className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-hover hover:text-foreground">
              All projects
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="rounded-lg bg-muted px-5 py-6 text-[15px] text-muted-foreground">No projects yet. Start with an idea above.</p>
        ) : (
          <ul className="divide-y rounded-lg">
            {recent.map((p) => {
              const stage = stageInfo(p.stage);
              return (
                <li key={p.id}>
                  <Link href={`${base}/projects/${p.id}`} className="group flex items-center gap-4 rounded-md px-2 py-3.5 hover:bg-hover">
                    <ProjectSwatch color={p.color} className="size-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{p.name}</span>
                      {p.idea && <span className="block truncate text-sm text-muted-foreground">{p.idea}</span>}
                    </span>
                    <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex" aria-label={`Stage: ${stage.label}`}>
                      <span className="flex gap-0.5" aria-hidden>
                        {JOURNEY.map((s, i) => (
                          <span key={s.id} className={`h-1.5 w-3 rounded-full ${i <= stageIndex(p.stage) ? "bg-tally" : "bg-border"}`} />
                        ))}
                      </span>
                      {stage.label}
                    </span>
                    <span className="w-24 text-right text-[13px] text-muted-foreground">{relativeTime(p.updatedAt)}</span>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Library</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHELVES.map(({ label, href, icon: Icon }) => (
            <Link key={label} href={`${base}/${href}`} className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] hover:bg-hover">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-[18px]" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </section>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clapperboard className="size-4" /> Everything you approve is remembered in the company library.
      </p>
    </PageContainer>
  );
}
