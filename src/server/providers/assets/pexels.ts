import { fetchJson, type AssetCandidate, type AssetSearchProvider } from "./types";

const PEXELS_NOTES =
  "Pexels licence: free for commercial use, no attribution required, modification allowed. Don't sell unaltered copies or imply endorsement by identifiable people or brands.";

function rights(pageUrl: string, creator: string | null) {
  return {
    source: "Pexels",
    sourceUrl: pageUrl,
    creator,
    license: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
    attributionRequired: false,
    commercialUse: true,
    modificationAllowed: true,
    collectedAt: new Date().toISOString(),
    notes: PEXELS_NOTES,
  };
}

/** Pexels: photos and video. Needs PEXELS_API_KEY. */
export const pexels: AssetSearchProvider = {
  id: "pexels",
  label: "Pexels",
  mediaTypes: ["image", "video"],
  async search({ query, mediaType, orientation, limit = 10 }) {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return [];
    const params = new URLSearchParams({ query, per_page: String(limit) });
    if (orientation) params.set("orientation", orientation);
    const headers = { authorization: key };

    if (mediaType === "video") {
      const data = await fetchJson<{
        videos: { id: number; url: string; image: string; duration: number; width: number; height: number; user: { name: string }; video_files: { link: string; width: number; height: number; quality: string }[] }[];
      }>(`https://api.pexels.com/videos/search?${params}`, { headers });
      return data.videos.map((v): AssetCandidate => {
        const file = [...v.video_files].sort((a, b) => (b.quality === "hd" ? 1 : 0) - (a.quality === "hd" ? 1 : 0))[0];
        return {
          provider: "pexels",
          externalId: String(v.id),
          title: v.url.split("/").filter(Boolean).pop()?.replace(/-\d+$/, "").replace(/-/g, " ") ?? "Pexels video",
          mediaType: "video",
          thumbnailUrl: v.image,
          mediaUrl: file?.link ?? v.url,
          pageUrl: v.url,
          width: v.width,
          height: v.height,
          durationMs: v.duration * 1000,
          rights: rights(v.url, v.user.name),
        };
      });
    }
    if (mediaType !== "image") return [];
    const data = await fetchJson<{
      photos: { id: number; url: string; alt: string; width: number; height: number; photographer: string; src: { large2x: string; medium: string } }[];
    }>(`https://api.pexels.com/v1/search?${params}`, { headers });
    return data.photos.map((p) => ({
      provider: "pexels",
      externalId: String(p.id),
      title: p.alt || "Pexels photo",
      mediaType: "image" as const,
      thumbnailUrl: p.src.medium,
      mediaUrl: p.src.large2x,
      pageUrl: p.url,
      width: p.width,
      height: p.height,
      durationMs: null,
      rights: rights(p.url, p.photographer),
    }));
  },
};
