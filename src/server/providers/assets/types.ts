import type { AssetRights } from "@/lib/creative-types";

export type SourcedMediaType = "image" | "video" | "audio";

export interface AssetQuery {
  query: string;
  mediaType: SourcedMediaType;
  orientation?: "portrait" | "landscape" | "square";
  limit?: number;
}

export interface AssetCandidate {
  provider: string;
  externalId: string;
  title: string;
  mediaType: SourcedMediaType;
  thumbnailUrl: string | null;
  /** Direct media file (image, mp4 or audio). */
  mediaUrl: string;
  pageUrl: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  rights: AssetRights;
}

export interface AssetSearchProvider {
  id: string;
  label: string;
  mediaTypes: SourcedMediaType[];
  search(query: AssetQuery): Promise<AssetCandidate[]>;
}

const UA = "Cutroom/0.1 (asset sourcing; contact: workspace admin)";

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "user-agent": UA, accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return (await res.json()) as T;
}

/** Interprets Creative Commons / public-domain licence codes. */
export function ccRights(code: string): Pick<AssetRights, "attributionRequired" | "commercialUse" | "modificationAllowed"> {
  const c = code.toLowerCase().replace(/^cc[\s-]*/, "");
  const publicDomain = c === "0" || c.includes("cc0") || c.includes("pdm") || c.includes("public domain") || c === "pd";
  return {
    attributionRequired: !publicDomain,
    commercialUse: !c.includes("nc"),
    modificationAllowed: !c.includes("nd"),
  };
}

export const stripHtml = (s: string | null | undefined) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;
