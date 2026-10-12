import type { Metadata } from "next";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { relativeTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { skillRun } from "@/server/db/schema";
import { getWorkspace } from "@/server/session";
import { listSkills } from "@/server/skills/registry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };

const STATUS: Record<string, string> = { succeeded: "text-success", failed: "text-destructive", cached: "text-muted-foreground", running: "text-tally" };
const usd = (n: number) => (n === 0 ? "$0" : n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  if (!can(ctx.role, { providers: ["manage"] })) {
    return <p className="text-[15px] text-muted-foreground">Only owners and admins can see AI activity.</p>;
  }
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [runs, [totals]] = await Promise.all([
    ctx.db.select().from(skillRun).where(eq(skillRun.organizationId, ctx.organization.id)).orderBy(desc(skillRun.startedAt)).limit(80),
    ctx.db
      .select({
        runs: sql<number>`count(*)::int`,
        cost: sql<number>`coalesce(sum(${skillRun.costUsd}), 0)::float`,
        failed: sql<number>`count(*) filter (where ${skillRun.status} = 'failed')::int`,
        cached: sql<number>`count(*) filter (where ${skillRun.status} = 'cached')::int`,
      })
      .from(skillRun)
      .where(and(eq(skillRun.organizationId, ctx.organization.id), gt(skillRun.startedAt, since))),
  ]);
  const skills = listSkills({ includePlanned: true });
  const name = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">What the AI did</h2>
          <p className="text-[15px] text-muted-foreground">Every skill run: why it ran, how long it took, which model it used and what it cost. Last 30 days.</p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
          {[
            ["Runs", totals?.runs ?? 0],
            ["Estimated cost", usd(totals?.cost ?? 0)],
            ["Served from cache", totals?.cached ?? 0],
            ["Failed", totals?.failed ?? 0],
          ].map(([k, v]) => (
            <div key={k} className="space-y-1 bg-background px-4 py-3">
              <dt className="label-meta">{k}</dt>
              <dd className="tabular text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {runs.length === 0 ? (
          <p className="rounded-lg bg-muted px-5 py-6 text-[15px] text-muted-foreground">Nothing has run yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {["When", "Skill", "Why", "Status", "Time", "Model", "Tokens", "Cost"].map((h) => (
                    <th key={h} className="label-meta px-3 py-2.5 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{relativeTime(r.startedAt)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("font-medium", r.parentRunId && "pl-3")}>{r.parentRunId ? "↳ " : ""}{name(r.skillId)}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {r.skillId} v{r.skillVersion}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      {r.reason}
                      {r.error && <span className="mt-1 block text-[13px] text-destructive">{r.error.slice(0, 200)}</span>}
                    </td>
                    <td className={cn("px-3 py-2.5 font-medium", STATUS[r.status])}>{r.status}</td>
                    <td className="tabular px-3 py-2.5 whitespace-nowrap">{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "–"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{r.model ?? (r.status === "cached" ? "cache" : "none")}</td>
                    <td className="tabular px-3 py-2.5 whitespace-nowrap text-muted-foreground">{r.inputTokens + r.outputTokens ? `${(r.inputTokens / 1000).toFixed(1)}k / ${(r.outputTokens / 1000).toFixed(1)}k` : "–"}</td>
                    <td className="tabular px-3 py-2.5 whitespace-nowrap">{usd(r.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Skill library</h2>
          <p className="text-[15px] text-muted-foreground">
            Each skill is one focused capability, defined in the repository&apos;s <code className="rounded bg-muted px-1 font-mono text-[13px]">skills/</code> folder. Planned skills are listed but not built yet.
          </p>
        </div>
        <ul className="divide-y rounded-lg border">
          {skills.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{s.name}</span> <span className="text-[12px] text-muted-foreground">{s.id} · v{s.version}</span>
                <span className="block text-sm text-muted-foreground">{s.description}</span>
              </span>
              <span className="text-[13px] text-muted-foreground">
                {s.category} · {s.executor} · {s.cost} cost
              </span>
              <span className={cn("rounded px-1.5 text-[12px] font-medium", s.status === "ready" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{s.status === "ready" ? "Ready" : "Planned"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
