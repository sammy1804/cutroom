import type { AssetRights } from "@/lib/creative-types";

/** A normalised catalog entry, ready to upsert into library_item. */
export interface HarvestedItem {
  source: string;
  externalId: string;
  kind: "lottie" | "texture" | "hdri";
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  files: Record<string, { url: string; size?: number }>;
  rights: AssetRights & { credit: string };
  features: Record<string, unknown>;
  sourceVersion: string | null;
}

/** Every harvester call identifies us, as source terms require (Poly Haven ToS 2.4). */
export const HARVESTER_UA = "Cutroom-Library-Harvester/1.0 (+https://cutroom-cyan-eight.vercel.app)";

export type Fetcher = (url: string) => Promise<unknown>;

export const httpJson: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": HARVESTER_UA, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return res.json();
};
