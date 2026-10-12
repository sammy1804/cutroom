import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewProjectFlow } from "@/components/projects/new-project-flow";
import { can } from "@/lib/permissions";
import { getWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  if (!can(ctx.role, { project: ["create"] })) redirect(`/w/${slug}/projects`);
  return <NewProjectFlow slug={slug} workspaceName={ctx.organization.name} />;
}
