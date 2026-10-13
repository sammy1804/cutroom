import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardStudio } from "@/components/board/board-studio";
import { storageUrl } from "@/lib/drag";
import { can } from "@/lib/permissions";
import { isClaudeConfigured } from "@/server/ai/claude";
import { AppError } from "@/server/errors";
import { getSession, getWorkspace } from "@/server/session";
import { getBoardState, listComments } from "@/server/services/board";
import { listAssets, listReferences } from "@/server/services/library";
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
  return { title: `${project.name} · Board` };
}

export default async function BoardPage({ params }: { params: Params }) {
  const { slug, projectId } = await params;
  const { ctx, project } = await load(slug, projectId);
  const [images, animations, refs] = await Promise.all([
    listAssets(ctx, { projectId: project.id, kind: "image", status: ["approved", "in_use"] }),
    listAssets(ctx, { projectId: project.id, kind: "animation", status: ["approved", "in_use"] }),
    listReferences(ctx, { projectId: project.id, limit: 120 }),
  ]);
  const assets = [...animations, ...images]
    .map((a) => ({
      id: a.id,
      kind: a.kind === "animation" ? ("animation" as const) : ("image" as const),
      name: a.name,
      url: storageUrl(a.storageKey) ?? a.externalUrl ?? "",
      thumbnailUrl: a.kind === "animation" ? a.thumbnailUrl : (a.thumbnailUrl ?? storageUrl(a.storageKey)),
      credit: a.rights?.attributionRequired ? ((a.metadata as { credit?: string }).credit ?? `${a.name} (${a.rights.source}, ${a.rights.license})`) : null,
    }))
    .filter((a) => a.url);
  const [{ board, version }, comments, session] = await Promise.all([getBoardState(ctx, project.id), listComments(ctx, project.id), getSession()]);

  return (
    <BoardStudio
      slug={slug}
      project={{ id: project.id, name: project.name, color: project.color }}
      me={{ id: ctx.userId, name: session?.user.name ?? "You" }}
      initialBoard={board}
      initialVersion={version}
      initialComments={comments}
      assets={assets}
      references={refs
        .filter((r) => r.status !== "rejected" && !r.parentId)
        .map((r) => ({ id: r.id, title: r.title, imageUrl: storageUrl(r.imageKey), url: r.url }))}
      canEdit={can(ctx.role, { project: ["update"] })}
      canModerate={ctx.role === "owner" || ctx.role === "admin"}
      aiEnabled={isClaudeConfigured()}
    />
  );
}
