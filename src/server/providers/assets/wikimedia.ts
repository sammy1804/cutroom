import { ccRights, fetchJson, stripHtml, type AssetSearchProvider } from "./types";

interface WmPage {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

/** Wikimedia Commons: free-licence media. No key required. */
export const wikimedia: AssetSearchProvider = {
  id: "wikimedia",
  label: "Wikimedia Commons",
  mediaTypes: ["image"],
  async search({ query, limit = 10 }) {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url|extmetadata|size|mime",
      iiurlwidth: "640",
      format: "json",
      origin: "*",
    });
    const data = await fetchJson<{ query?: { pages: Record<string, WmPage> } }>(`https://commons.wikimedia.org/w/api.php?${params}`);
    return Object.values(data.query?.pages ?? {}).flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info || !info.mime.startsWith("image/")) return [];
      const meta = info.extmetadata ?? {};
      const license = stripHtml(meta.LicenseShortName?.value) ?? "Unknown licence";
      const rights = ccRights(license);
      return [
        {
          provider: "wikimedia",
          externalId: String(p.pageid),
          title: stripHtml(meta.ObjectName?.value) ?? p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
          mediaType: "image" as const,
          thumbnailUrl: info.thumburl ?? info.url,
          mediaUrl: info.url,
          pageUrl: info.descriptionurl,
          width: info.width,
          height: info.height,
          durationMs: null,
          rights: {
            source: "Wikimedia Commons",
            sourceUrl: info.descriptionurl,
            creator: stripHtml(meta.Artist?.value),
            license,
            licenseUrl: stripHtml(meta.LicenseUrl?.value),
            ...rights,
            attributionRequired: meta.AttributionRequired?.value === "false" ? false : rights.attributionRequired,
            collectedAt: new Date().toISOString(),
            notes: license === "Unknown licence" ? "Licence could not be read; check the file page before use." : undefined,
          },
        },
      ];
    });
  },
};
