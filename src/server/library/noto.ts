import type { Fetcher, HarvestedItem } from "./types";

/**
 * Animated Noto Emoji (Google): Lottie animations published with an index at
 * googlefonts.github.io and files on fonts.gstatic.com. Licence: CC BY 4.0,
 * so credit is required and travels with every use.
 */

const INDEX = "https://googlefonts.github.io/noto-emoji-animation/data/api.json";
const CDN = "https://fonts.gstatic.com/s/e/notoemoji/latest";

interface NotoIcon {
  name: string;
  codepoint: string;
  popularity: number;
  categories: string[];
  tags: string[];
  version?: number;
}

export async function fetchNotoIndex(fetcher: Fetcher): Promise<NotoIcon[]> {
  const data = (await fetcher(INDEX)) as { icons?: NotoIcon[] };
  if (!Array.isArray(data.icons)) throw new Error("Noto index has no icons array");
  return data.icons;
}

const titleCase = (s: string) => s.replace(/[:_-]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Pure: Noto index entry → catalog item. */
export function normalizeNoto(icon: NotoIcon): HarvestedItem {
  const cp = icon.codepoint.toLowerCase();
  const label = icon.tags[0] ? titleCase(icon.tags[0]) : icon.name;
  const char = cp
    .split("_")
    .map((h) => String.fromCodePoint(parseInt(h, 16)))
    .join("");
  return {
    source: "noto-emoji",
    externalId: cp,
    kind: "lottie",
    name: `${char} ${label}`.trim(),
    description: null,
    category: icon.categories[0] ?? null,
    tags: [...new Set([...icon.tags.map((t) => t.replace(/:/g, "").toLowerCase()), ...icon.categories.map((c) => c.toLowerCase()), "emoji"])],
    thumbnailUrl: `${CDN}/${cp}/128.png`,
    previewUrl: `${CDN}/${cp}/512.webp`,
    files: { lottie: { url: `${CDN}/${cp}/lottie.json` }, gif: { url: `${CDN}/${cp}/512.gif` } },
    rights: {
      source: "Animated Noto Emoji (Google)",
      sourceUrl: "https://googlefonts.github.io/noto-emoji-animation/",
      creator: "Google",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attributionRequired: true,
      commercialUse: true,
      modificationAllowed: true,
      collectedAt: new Date().toISOString(),
      notes: "Credit is required wherever the animation is published (e.g. in the post caption or end credits).",
      credit: "Animated Noto Emoji by Google, CC BY 4.0",
    },
    features: { popularity: icon.popularity, codepoint: cp },
    sourceVersion: String(icon.version ?? 1),
  };
}
