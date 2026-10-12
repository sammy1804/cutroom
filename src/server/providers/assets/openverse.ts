import { ccRights, fetchJson, type AssetSearchProvider } from "./types";

interface OvResult {
  id: string;
  title: string | null;
  url: string;
  thumbnail: string | null;
  foreign_landing_url: string;
  creator: string | null;
  license: string;
  license_version: string | null;
  license_url: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  source?: string;
}

/** Openverse: openly licensed images and audio. No key required. */
export const openverse: AssetSearchProvider = {
  id: "openverse",
  label: "Openverse",
  mediaTypes: ["image", "audio"],
  async search({ query, mediaType, orientation, limit = 10 }) {
    const endpoint = mediaType === "audio" ? "audio" : "images";
    const params = new URLSearchParams({ q: query, page_size: String(limit), license_type: "commercial" });
    if (mediaType === "image" && orientation) params.set("aspect_ratio", orientation === "portrait" ? "tall" : orientation === "landscape" ? "wide" : "square");
    const data = await fetchJson<{ results: OvResult[] }>(`https://api.openverse.org/v1/${endpoint}/?${params}`);
    return data.results.map((r) => {
      const license = `${r.license.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ""}`;
      return {
        provider: "openverse",
        externalId: r.id,
        title: r.title ?? "Untitled",
        mediaType: mediaType === "audio" ? "audio" : "image",
        thumbnailUrl: r.thumbnail,
        mediaUrl: r.url,
        pageUrl: r.foreign_landing_url,
        width: r.width ?? null,
        height: r.height ?? null,
        durationMs: r.duration ?? null,
        rights: {
          source: `Openverse${r.source ? ` / ${r.source}` : ""}`,
          sourceUrl: r.foreign_landing_url,
          creator: r.creator,
          license: license.startsWith("CC0") || license.startsWith("PDM") ? license : `CC ${license}`,
          licenseUrl: r.license_url,
          ...ccRights(r.license),
          collectedAt: new Date().toISOString(),
        },
      };
    });
  },
};
