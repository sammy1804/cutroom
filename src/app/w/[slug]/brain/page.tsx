import type { Metadata } from "next";
import Link from "next/link";
import { BrainStart } from "@/components/brain/brain-start";
import { ClaudeNotice } from "@/components/claude-notice";
import { PageContainer, PageHeader } from "@/components/page-header";
import { relativeTime } from "@/lib/format";
import { isClaudeConfigured } from "@/server/ai/claude";
import { listBrainThreads } from "@/server/services/brain";
import { getWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Brain" };

export default async function BrainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  const threads = await listBrainThreads(ctx);
  return (
    <PageContainer className="max-w-[920px] space-y-10">
      <PageHeader title="Brain" description="Think out loud. Bring an unfinished idea; get directions, reasons, research and references back, then push on any of them." />
      <ClaudeNotice />
      <BrainStart slug={slug} aiEnabled={isClaudeConfigured()} autoFocus />
      {threads.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Earlier sessions</h2>
          <ul>
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/w/${slug}/brain/${t.id}`} className="flex items-baseline justify-between gap-4 rounded-md px-2 py-3 hover:bg-hover">
                  <span className="truncate text-[16px]">{t.title}</span>
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {t.projectId ? "became a project · " : ""}
                    {relativeTime(t.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
