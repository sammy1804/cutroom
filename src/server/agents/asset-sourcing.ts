import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { imageBlock, structured } from "@/server/ai/claude";
import { ASSET_PROVIDERS, type AssetCandidate, type SourcedMediaType } from "@/server/providers/assets";

/**
 * AssetSourcingAgent: requirement → visual search concepts → licence-aware
 * providers → candidates ranked by how well they *look* like the intended shot.
 */

const planSchema = z.object({
  mediaType: z.enum(["image", "video", "audio"]),
  orientation: z.enum(["portrait", "landscape", "square", "any"]),
  compositionIntent: z.string().describe("What the ideal frame looks like: subject, scale, framing, light, movement, mood"),
  concepts: z.array(z.string()).describe("6 short, diverse stock-search queries that would surface visually matching results"),
  avoid: z.array(z.string()).describe("Visual traits that would make a result wrong"),
});

const rankSchema = z.object({
  ranked: z.array(z.object({ index: z.number(), score: z.number().describe("0–100 visual match"), reason: z.string() })),
});

export type SourcingPlan = z.infer<typeof planSchema>;
export interface RankedCandidate extends AssetCandidate {
  score: number;
  reason: string;
}

export interface SourcingResult {
  requirement: string;
  plan: SourcingPlan;
  candidates: RankedCandidate[];
  searched: string[];
  unavailable: string[];
}

export async function sourceAssets(
  input: { requirement: string; mediaType?: SourcedMediaType; aspectRatio?: string; direction?: string; providers: string[] },
  report: (p: number) => Promise<void>,
): Promise<SourcingResult> {
  const plan = await structured({
    schema: planSchema,
    effort: "low",
    system:
      "You are a picture researcher for a video studio. Turn a shot requirement into stock-library searches. Think " +
      "visually: subject, scale, framing, light and mood, not just the literal words. Queries are 2–5 words each and " +
      "vary in angle (literal, mood, composition, silhouette, setting).",
    content: [
      `Requirement: ${input.requirement}`,
      input.mediaType && `Media type: ${input.mediaType}`,
      input.aspectRatio && `Target aspect ratio: ${input.aspectRatio}`,
      input.direction && `Creative direction: ${input.direction}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  const mediaType = input.mediaType ?? plan.mediaType;
  await report(20);

  const usable = input.providers.map((id) => ASSET_PROVIDERS[id]).filter((p) => p && p.mediaTypes.includes(mediaType));
  const unavailable = Object.values(ASSET_PROVIDERS)
    .filter((p) => p.mediaTypes.includes(mediaType) && !usable.includes(p))
    .map((p) => p.label);
  const orientation = plan.orientation === "any" ? undefined : plan.orientation;

  const settled = await Promise.allSettled(
    usable.flatMap((provider) => plan.concepts.slice(0, 4).map((query) => provider.search({ query, mediaType, orientation, limit: 6 }))),
  );
  const seen = new Set<string>();
  const pool: AssetCandidate[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") {
      console.warn("[asset-sourcing] provider search failed", r.reason);
      continue;
    }
    for (const c of r.value) {
      const id = `${c.provider}:${c.externalId}`;
      if (!seen.has(id) && c.rights.commercialUse) {
        seen.add(id);
        pool.push(c);
      }
    }
  }
  await report(55);

  const shortlist = interleave(pool).slice(0, 18);
  const candidates = shortlist.length ? await rank(shortlist, plan, mediaType) : [];
  await report(95);

  return {
    requirement: input.requirement,
    plan: { ...plan, mediaType },
    candidates,
    searched: usable.map((p) => p.label),
    unavailable,
  };
}

async function rank(shortlist: AssetCandidate[], plan: SourcingPlan, mediaType: SourcedMediaType): Promise<RankedCandidate[]> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const thumbs = await Promise.all(shortlist.map((c) => (mediaType === "audio" ? null : fetchThumb(c.thumbnailUrl))));
  shortlist.forEach((c, i) => {
    content.push({ type: "text", text: `#${i} — ${c.title} (${c.provider}${c.width ? `, ${c.width}×${c.height}` : ""}${c.durationMs ? `, ${Math.round(c.durationMs / 1000)}s` : ""})` });
    const t = thumbs[i];
    if (t) content.push(imageBlock(t.data, t.type));
  });
  content.push({
    type: "text",
    text: `Intended ${mediaType}: ${plan.compositionIntent}\nAvoid: ${plan.avoid.join("; ") || "nothing specific"}\n\nScore every candidate by visual fit with the intended frame.`,
  });

  const { ranked } = await structured({
    schema: rankSchema,
    effort: "low",
    system: "You are a picture editor. Judge candidates on composition, subject, light and mood against the intended shot. Be decisive; most candidates are mediocre.",
    content,
  });
  const byIndex = new Map(ranked.map((r) => [r.index, r]));
  return shortlist
    .map((c, i) => ({ ...c, score: Math.round(byIndex.get(i)?.score ?? 0), reason: byIndex.get(i)?.reason ?? "" }))
    .sort((a, b) => b.score - a.score);
}

/** Round-robin across providers so one source doesn't crowd out the others. */
function interleave(pool: AssetCandidate[]) {
  const groups = new Map<string, AssetCandidate[]>();
  for (const c of pool) groups.set(c.provider, [...(groups.get(c.provider) ?? []), c]);
  const out: AssetCandidate[] = [];
  const lists = [...groups.values()];
  for (let i = 0; out.length < pool.length; i++) for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}

async function fetchThumb(url: string | null): Promise<{ data: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Cutroom/0.1" } });
    const type = res.headers.get("content-type")?.split(";")[0];
    if (!res.ok || !type || !["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.byteLength > 3_000_000) return null;
    return { data, type: type as "image/jpeg" | "image/png" | "image/webp" };
  } catch {
    return null;
  }
}
