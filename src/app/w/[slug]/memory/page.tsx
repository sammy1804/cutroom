import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/format";
import { getWorkspace } from "@/server/session";
import { listMemory } from "@/server/services/library";

export const metadata: Metadata = { title: "Creative library" };

const GROUPS = [
  { kind: "direction", label: "Creative directions", hint: "Approved CreativeDNA" },
  { kind: "animation", label: "Animations", hint: "Motion the team signed off" },
  { kind: "transition", label: "Transitions", hint: "Cuts the team signed off" },
  { kind: "reference", label: "References", hint: "What good looks like" },
  { kind: "asset", label: "Assets", hint: "Approved, licence-checked media" },
  { kind: "campaign", label: "Campaigns", hint: "Approved campaigns" },
  { kind: "composition", label: "Compositions", hint: "Approved layouts" },
] as const;

export default async function MemoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const memory = await listMemory(ctx);

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow={ctx.organization.name}
        title="Company creative library"
        description="Every creative decision your team approves is remembered here. Claude reads it when it recommends motion, builds CreativeDNA and ranks options, so the studio learns how this company designs."
      />
      {memory.length === 0 ? (
        <EmptyState
          icon={<BrainCircuit />}
          title="Nothing approved yet"
          description="Approve references, animations, assets and creative directions as you work. Each approval becomes part of the company's creative memory."
        />
      ) : (
        GROUPS.map((g) => {
          const items = memory.filter((m) => m.kind === g.kind);
          if (!items.length) return null;
          return (
            <section key={g.kind} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold tracking-tight">
                  {g.label} <span className="tabular ml-1 text-sm text-muted-foreground">{items.length}</span>
                </h2>
                <span className="text-sm text-muted-foreground">{g.hint}</span>
              </div>
              <ul className="divide-y rounded-lg bg-card shadow-card">
                {items.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{m.title}</p>
                      {Array.isArray(m.payload.learnings) && (m.payload.learnings as string[]).length > 0 && (
                        <p className="text-sm text-muted-foreground">{(m.payload.learnings as string[]).slice(0, 2).join(" · ")}</p>
                      )}
                      {Array.isArray(m.payload.dimensions) && <p className="text-sm text-muted-foreground">{(m.payload.dimensions as string[]).slice(0, 3).join(" · ")}</p>}
                      {typeof m.payload.license === "string" && <p className="text-[13px] text-muted-foreground">{m.payload.license}</p>}
                    </div>
                    <span className="text-[13px] text-muted-foreground">{relativeTime(m.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </PageContainer>
  );
}
