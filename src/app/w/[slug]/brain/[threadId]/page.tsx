import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrainThreadView } from "@/components/brain/brain-thread";
import { PageContainer } from "@/components/page-header";
import { can } from "@/lib/permissions";
import { isClaudeConfigured } from "@/server/ai/claude";
import { AppError } from "@/server/errors";
import { getBrainThread } from "@/server/services/brain";
import { getWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Brain" };

export default async function BrainThreadPage({ params }: { params: Promise<{ slug: string; threadId: string }> }) {
  const { slug, threadId } = await params;
  const ctx = await getWorkspace(slug);
  const thread = await getBrainThread(ctx, threadId).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <PageContainer className="max-w-[980px] space-y-6">
      <nav className="label-meta" aria-label="Breadcrumb">
        <Link href={`/w/${slug}/brain`} className="hover:text-foreground">
          Brain
        </Link>
      </nav>
      <BrainThreadView
        slug={slug}
        threadId={thread.id}
        turns={thread.turns}
        projectId={thread.projectId}
        aiEnabled={isClaudeConfigured()}
        canCreate={can(ctx.role, { project: ["create"] })}
      />
    </PageContainer>
  );
}
