"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/errors";
import { actionWorkspace } from "@/server/session";
import {
  createCampaign,
  deleteCampaign,
  setCampaignStatus,
  updateCampaign,
} from "@/server/services/campaigns";
import {
  createProject,
  deleteProject,
  setProjectArchived,
  updateProject,
} from "@/server/services/projects";
import type { CampaignInput, ProjectInput } from "@/lib/validation";

export async function createProjectAction(
  slug: string,
  input: ProjectInput,
  firstCampaign?: CampaignInput,
) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const created = await createProject(ctx, input);
    const campaign = firstCampaign ? await createCampaign(ctx, created.id, firstCampaign) : null;
    revalidatePath(`/w/${slug}`, "layout");
    return { id: created.id, campaignId: campaign?.id ?? null };
  });
}

export async function updateProjectAction(slug: string, projectId: string, input: ProjectInput) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    await updateProject(ctx, projectId, input);
    revalidatePath(`/w/${slug}`, "layout");
  });
}

export async function archiveProjectAction(slug: string, projectId: string, archived: boolean) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    await setProjectArchived(ctx, projectId, archived);
    revalidatePath(`/w/${slug}`, "layout");
  });
}

export async function deleteProjectAction(slug: string, projectId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    await deleteProject(ctx, projectId);
    revalidatePath(`/w/${slug}`, "layout");
  });
}

export async function createCampaignAction(slug: string, projectId: string, input: CampaignInput) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const created = await createCampaign(ctx, projectId, input);
    revalidatePath(`/w/${slug}`, "layout");
    return { id: created.id };
  });
}

export async function updateCampaignAction(slug: string, campaignId: string, input: CampaignInput) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    await updateCampaign(ctx, campaignId, input);
    revalidatePath(`/w/${slug}`, "layout");
  });
}

export async function setCampaignStatusAction(slug: string, campaignId: string, status: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    await setCampaignStatus(ctx, campaignId, status);
    revalidatePath(`/w/${slug}`, "layout");
  });
}

export async function deleteCampaignAction(slug: string, campaignId: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    await deleteCampaign(ctx, campaignId);
    revalidatePath(`/w/${slug}`, "layout");
  });
}
