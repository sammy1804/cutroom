"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/errors";
import { startJob } from "@/server/jobs/runner";
import { actionWorkspace } from "@/server/session";
import { assertCan } from "@/server/services/context";
import { getProject } from "@/server/services/projects";
import { importLibraryItem, searchOpenLibrary, toOpenLibraryCard, type OpenSource } from "@/server/services/open-library";
import { runSkill } from "@/server/skills/runtime";

const HARVESTERS: Record<OpenSource, string> = {
  polyhaven: "library.harvest-polyhaven",
  "noto-emoji": "library.harvest-noto-emoji",
};

/** Starts a background sync of one open source. Admins only: the catalog is shared. */
export async function harvestOpenLibraryAction(slug: string, source: OpenSource) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    assertCan(ctx, { providers: ["manage"] });
    const skillId = HARVESTERS[z.enum(["polyhaven", "noto-emoji"]).parse(source)];
    const j = await startJob(ctx, { kind: "library_harvest", input: { source } }, async (report) => {
      const { output } = await runSkill(ctx, skillId, {}, { reason: `Sync open library: ${source}`, onProgress: report, useCache: false });
      return output as Record<string, unknown>;
    });
    revalidatePath(`/w/${slug}/settings/sources`);
    return { jobId: j.id };
  });
}

const searchInput = z.object({
  q: z.string().max(200).optional(),
  kind: z.enum(["lottie", "texture", "hdri"]).optional(),
  category: z.string().max(80).optional(),
  offset: z.number().int().min(0).max(5000).optional(),
});

export async function searchOpenLibraryAction(slug: string, input: z.input<typeof searchInput>) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    const { items, hasMore } = await searchOpenLibrary(ctx, { ...searchInput.parse(input), limit: 48 });
    return { items: items.map(toOpenLibraryCard), hasMore };
  });
}

export async function importLibraryItemAction(slug: string, itemId: string, projectId?: string) {
  return runAction(async () => {
    const ctx = await actionWorkspace(slug);
    if (projectId) await getProject(ctx, projectId);
    const { asset, created } = await importLibraryItem(ctx, z.string().min(1).parse(itemId), { projectId: projectId ?? null });
    revalidatePath(`/w/${slug}/library`);
    if (projectId) revalidatePath(`/w/${slug}/projects/${projectId}`);
    return { assetId: asset.id, created };
  });
}
