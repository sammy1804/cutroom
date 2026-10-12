import { z } from "zod";
import { defineSkill } from "@/server/skills/types";

const rights = z.object({
  source: z.string(),
  sourceUrl: z.string(),
  creator: z.string().nullable(),
  license: z.string(),
  licenseUrl: z.string().nullable(),
  attributionRequired: z.boolean(),
  commercialUse: z.boolean(),
  modificationAllowed: z.boolean(),
  collectedAt: z.string(),
  notes: z.string().optional(),
});

export const sourcingOutput = z.object({
  requirement: z.string(),
  plan: z.object({ mediaType: z.enum(["image", "video", "audio"]), orientation: z.string(), compositionIntent: z.string(), concepts: z.array(z.string()), avoid: z.array(z.string()) }),
  candidates: z.array(
    z.object({
      provider: z.string(),
      externalId: z.string(),
      title: z.string(),
      mediaType: z.enum(["image", "video", "audio"]),
      thumbnailUrl: z.string().nullable(),
      mediaUrl: z.string(),
      pageUrl: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      durationMs: z.number().nullable(),
      rights,
      score: z.number(),
      reason: z.string(),
    }),
  ),
  searched: z.array(z.string()),
  unavailable: z.array(z.string()),
});

export default defineSkill({
  id: "production.asset-search",
  input: z.object({
    requirement: z.string().min(3).max(600),
    mediaType: z.enum(["image", "video", "audio"]).optional(),
    aspectRatio: z.string().optional(),
    direction: z.string().optional(),
  }),
  output: sourcingOutput,
  cache: { ttlSeconds: 60 * 60 * 6 },
  timeoutMs: 200_000,
  async run(input, ctx) {
    const { enabledAssetProviders } = await import("@/server/services/sources");
    const { sourceAssets } = await import("@/server/agents/asset-sourcing");
    const providers = await enabledAssetProviders(ctx.ws);
    if (!providers.length) throw new Error("No asset sources are enabled. Turn one on in Settings → Sources.");
    return sourceAssets({ ...input, providers }, ctx.progress);
  },
});
