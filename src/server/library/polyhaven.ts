import type { Fetcher, HarvestedItem } from "./types";

/**
 * Poly Haven (polyhaven.com): CC0 textures and HDRIs via the official public API.
 * Terms: unique user agent on every call, and a visible "Poly Haven" credit where
 * live API content is shown. Downloaded/self-hosted copies are plain CC0.
 */

const API = "https://api.polyhaven.com";

interface PhAsset {
  type: 0 | 1 | 2;
  name: string;
  description?: string;
  tags?: string[];
  categories?: string[];
  category?: string;
  authors?: Record<string, string>;
  download_count?: number;
  max_resolution?: [number, number];
  dimensions?: [number, number];
  attributes?: Record<string, unknown>;
  files_hash?: string;
  thumbnail_url?: string;
  date_published?: number;
}

export type PolyHavenType = "textures" | "hdris";

export async function fetchPolyHavenIndex(type: PolyHavenType, fetcher: Fetcher): Promise<Record<string, PhAsset>> {
  return (await fetcher(`${API}/assets?type=${type}`)) as Record<string, PhAsset>;
}

/** Pure: Poly Haven asset entry → catalog item. Files are resolved lazily on first use. */
export function normalizePolyHaven(slug: string, a: PhAsset): HarvestedItem | null {
  const kind = a.type === 0 ? "hdri" : a.type === 1 ? "texture" : null;
  if (!kind) return null;
  const authors = Object.keys(a.authors ?? {});
  const page = `https://polyhaven.com/a/${slug}`;
  return {
    source: "polyhaven",
    externalId: slug,
    kind,
    name: a.name,
    description: a.description ?? null,
    category: a.category?.split("/")[0]?.trim() ?? a.categories?.[0] ?? null,
    tags: [...new Set([...(a.tags ?? []), ...(a.categories ?? [])].map((t) => t.toLowerCase()))].slice(0, 30),
    thumbnailUrl: a.thumbnail_url ?? `https://cdn.polyhaven.com/asset_img/thumbs/${slug}.png?width=320&height=320`,
    previewUrl: null,
    files: {},
    rights: {
      source: "Poly Haven",
      sourceUrl: page,
      creator: authors.join(", ") || null,
      license: "CC0 1.0",
      licenseUrl: "https://polyhaven.com/license",
      attributionRequired: false,
      commercialUse: true,
      modificationAllowed: true,
      collectedAt: new Date().toISOString(),
      notes: "CC0. Shown via the Poly Haven API; credit Poly Haven where live content appears.",
      credit: `${a.name} by ${authors.join(", ") || "Poly Haven"} (Poly Haven, CC0)`,
    },
    features: {
      popularity: a.download_count ?? 0,
      maxResolution: a.max_resolution ?? null,
      dimensionsMm: a.dimensions ?? null,
      attributes: a.attributes ?? {},
      published: a.date_published ?? null,
    },
    sourceVersion: a.files_hash ?? null,
  };
}

/** Resolves concrete download URLs for one asset at a given resolution (on first use, not during harvest). */
export async function resolvePolyHavenFiles(slug: string, kind: "texture" | "hdri", fetcher: Fetcher, res = "1k") {
  const tree = (await fetcher(`${API}/files/${slug}`)) as Record<string, Record<string, Record<string, { url: string; size: number }>>>;
  if (kind === "hdri") {
    const tonemapped = (tree as unknown as { tonemapped?: { url: string; size: number } }).tonemapped;
    const hdr = tree.hdri?.[res]?.hdr;
    return { image: tonemapped ?? null, hdr: hdr ?? null };
  }
  const diffuseKey = ["Diffuse", "diffuse", "Color", "albedo"].find((k) => tree[k]);
  const diffuse = diffuseKey ? (tree[diffuseKey]![res]?.jpg ?? tree[diffuseKey]![res]?.png) : undefined;
  return { image: diffuse ?? null, hdr: null };
}
