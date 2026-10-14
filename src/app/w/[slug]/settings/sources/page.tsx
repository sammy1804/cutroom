import type { Metadata } from "next";
import { AddSourceForm, SourceToggle } from "@/components/settings/sources";
import { can } from "@/lib/permissions";
import { DEFAULT_SOURCES, RIGHTS_LABEL, SOURCE_TYPE_LABEL } from "@/lib/sources";
import { getWorkspace } from "@/server/session";
import { listSources } from "@/server/services/sources";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const sources = await listSources(ctx);
  const canManage = can(ctx.role, { providers: ["manage"] });
  const groups = [
    { role: "reference", title: "Visual references", text: "The browser research agent may open these sites to learn direction. Nothing from them is ever used as a production asset." },
    { role: "asset", title: "Licence-aware assets", text: "The asset sourcing agent searches these providers. Every result is saved with its licence, creator and usage terms." },
  ] as const;

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.role} className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{g.title}</h2>
            <p className="max-w-[70ch] text-[15px] text-muted-foreground">{g.text}</p>
          </div>
          <ul className="divide-y rounded-lg bg-card shadow-card">
            {sources
              .filter((s) => s.role === g.role)
              .map((s) => {
                const def = DEFAULT_SOURCES.find((d) => d.key === s.key);
                const missingKey = def?.requiresEnv && !process.env[def.requiresEnv] ? def.requiresEnv : null;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                          {s.name}
                        </a>
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{SOURCE_TYPE_LABEL[s.type]}</span>
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{RIGHTS_LABEL[s.rightsPolicy]}</span>
                        <span className="text-[13px] text-muted-foreground uppercase">{s.accessMethod}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{s.purpose}</p>
                      {missingKey && <p className="text-sm text-tally">Add {missingKey} to .env.local to use this source.</p>}
                    </div>
                    <SourceToggle slug={slug} id={s.id} enabled={s.enabled} disabled={!canManage || Boolean(missingKey) || s.accessMethod === "manual"} name={s.name} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {canManage && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Add a reference source</h2>
            <p className="text-[15px] text-muted-foreground">Custom sources are always reference-only; their licence can&apos;t be verified automatically.</p>
          </div>
          <AddSourceForm slug={slug} />
        </section>
      )}
    </div>
  );
}
