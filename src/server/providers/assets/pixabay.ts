import { fetchJson, type AssetSearchProvider } from "./types";

const NOTES = "Pixabay Content License: commercial use and modification allowed, no attribution required. Don't redistribute standalone or depict trademarks/people in a misleading way.";

function rights(pageUrl: string, creator: string | null) {
  return {
    source: "Pixabay",
    sourceUrl: pageUrl,
    creator,
    license: "Pixabay Content License",
    licenseUrl: "https://pixabay.com/service/license-summary/",
    attributionRequired: false,
    commercialUse: true,
    modificationAllowed: true,
    collectedAt: new Date().toISOString(),
    notes: NOTES,
  };
}

/** Pixabay: photos, illustration and video. Needs PIXABAY_API_KEY. */
export const pixabay: AssetSearchProvider = {
  id: "pixabay",
  label: "Pixabay",
  mediaTypes: ["image", "video"],
  async search({ query, mediaType, orientation, limit = 10 }) {
    const key = process.env.PIXABAY_API_KEY;
    if (!key || mediaType === "audio") return [];
    const params = new URLSearchParams({ key, q: query.slice(0, 100), per_page: String(Math.max(3, limit)), safesearch: "true" });
    if (mediaType === "image" && orientation && orientation !== "square") params.set("orientation", orientation === "portrait" ? "vertical" : "horizontal");

    if (mediaType === "video") {
      const data = await fetchJson<{
        hits: { id: number; pageURL: string; tags: string; duration: number; user: string; videos: Record<string, { url: string; width: number; height: number; thumbnail?: string }> }[];
      }>(`https://pixabay.com/api/videos/?${params}`);
      return data.hits.map((h) => {
        const file = h.videos.large?.url ? h.videos.large : h.videos.medium;
        return {
          provider: "pixabay",
          externalId: String(h.id),
          title: h.tags,
          mediaType: "video" as const,
          thumbnailUrl: h.videos.medium?.thumbnail ?? h.videos.small?.thumbnail ?? null,
          mediaUrl: file?.url ?? h.pageURL,
          pageUrl: h.pageURL,
          width: file?.width ?? null,
          height: file?.height ?? null,
          durationMs: h.duration * 1000,
          rights: rights(h.pageURL, h.user),
        };
      });
    }
    const data = await fetchJson<{
      hits: { id: number; pageURL: string; tags: string; user: string; webformatURL: string; largeImageURL: string; imageWidth: number; imageHeight: number }[];
    }>(`https://pixabay.com/api/?${params}&image_type=photo`);
    return data.hits.map((h) => ({
      provider: "pixabay",
      externalId: String(h.id),
      title: h.tags,
      mediaType: "image" as const,
      thumbnailUrl: h.webformatURL,
      mediaUrl: h.largeImageURL,
      pageUrl: h.pageURL,
      width: h.imageWidth,
      height: h.imageHeight,
      durationMs: null,
      rights: rights(h.pageURL, h.user),
    }));
  },
};
