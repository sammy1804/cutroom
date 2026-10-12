/**
 * Default Source Registry. Each workspace gets a copy it can enable, disable
 * or extend. `role` is the hard line between REFERENCE and USABLE ASSET:
 * reference sources are for learning direction only and never produce assets.
 */

export type SourceType =
  | "DESIGN_REFERENCE"
  | "MOTION_REFERENCE"
  | "PHOTOGRAPHY"
  | "VIDEO"
  | "ILLUSTRATION"
  | "TYPOGRAPHY"
  | "3D"
  | "TEXTURE"
  | "ICON"
  | "AUDIO";

export interface SourceDefinition {
  key: string;
  name: string;
  url: string;
  type: SourceType;
  role: "reference" | "asset";
  purpose: string;
  accessMethod: "browser" | "api" | "manual";
  rightsPolicy: "reference_only" | "per_item_license" | "platform_license";
  apiProvider?: "openverse" | "wikimedia" | "pexels" | "pixabay";
  /** Env var an API source needs before it can be used. */
  requiresEnv?: string;
  enabledByDefault?: boolean;
}

export const DEFAULT_SOURCES: SourceDefinition[] = [
  // Visual references: look, learn, never reuse.
  { key: "arena", name: "Are.na", url: "https://www.are.na", type: "DESIGN_REFERENCE", role: "reference", purpose: "Curated visual research boards and art direction", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "cosmos", name: "Cosmos", url: "https://www.cosmos.so", type: "DESIGN_REFERENCE", role: "reference", purpose: "Mood and art-direction collections", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "pinterest", name: "Pinterest", url: "https://www.pinterest.com", type: "PHOTOGRAPHY", role: "reference", purpose: "Broad mood and photography direction", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "behance", name: "Behance", url: "https://www.behance.net", type: "DESIGN_REFERENCE", role: "reference", purpose: "Campaign and identity case studies", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "awwwards", name: "Awwwards", url: "https://www.awwwards.com", type: "MOTION_REFERENCE", role: "reference", purpose: "Interaction and web motion", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "godly", name: "Godly", url: "https://godly.website", type: "MOTION_REFERENCE", role: "reference", purpose: "Motion-led web design", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "siteinspire", name: "SiteInspire", url: "https://www.siteinspire.com", type: "DESIGN_REFERENCE", role: "reference", purpose: "Layout and typography on the web", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "landbook", name: "Land-book", url: "https://land-book.com", type: "DESIGN_REFERENCE", role: "reference", purpose: "Landing page composition", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "refero", name: "Refero", url: "https://refero.design", type: "DESIGN_REFERENCE", role: "reference", purpose: "Product UI patterns", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "dribbble", name: "Dribbble", url: "https://dribbble.com", type: "ILLUSTRATION", role: "reference", purpose: "Illustration, icon and motion shots", accessMethod: "browser", rightsPolicy: "reference_only" },
  { key: "fontsinuse", name: "Fonts In Use", url: "https://fontsinuse.com", type: "TYPOGRAPHY", role: "reference", purpose: "Typography in real campaigns", accessMethod: "browser", rightsPolicy: "reference_only" },

  // Licence-aware asset providers.
  { key: "openverse", name: "Openverse", url: "https://openverse.org", type: "PHOTOGRAPHY", role: "asset", purpose: "Openly licensed images and audio (CC and public domain)", accessMethod: "api", rightsPolicy: "per_item_license", apiProvider: "openverse", enabledByDefault: true },
  { key: "wikimedia", name: "Wikimedia Commons", url: "https://commons.wikimedia.org", type: "PHOTOGRAPHY", role: "asset", purpose: "Free-licence photography and illustration", accessMethod: "api", rightsPolicy: "per_item_license", apiProvider: "wikimedia", enabledByDefault: true },
  { key: "pexels", name: "Pexels", url: "https://www.pexels.com", type: "VIDEO", role: "asset", purpose: "Stock photos and vertical video", accessMethod: "api", rightsPolicy: "platform_license", apiProvider: "pexels", requiresEnv: "PEXELS_API_KEY" },
  { key: "pixabay", name: "Pixabay", url: "https://pixabay.com", type: "VIDEO", role: "asset", purpose: "Stock photos, illustration and video", accessMethod: "api", rightsPolicy: "platform_license", apiProvider: "pixabay", requiresEnv: "PIXABAY_API_KEY" },
  { key: "coverr", name: "Coverr", url: "https://coverr.co", type: "VIDEO", role: "asset", purpose: "Free b-roll footage (download manually and upload)", accessMethod: "manual", rightsPolicy: "platform_license" },
];

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  DESIGN_REFERENCE: "Design",
  MOTION_REFERENCE: "Motion",
  PHOTOGRAPHY: "Photography",
  VIDEO: "Video",
  ILLUSTRATION: "Illustration",
  TYPOGRAPHY: "Typography",
  "3D": "3D",
  TEXTURE: "Texture",
  ICON: "Icons",
  AUDIO: "Audio",
};

export const RIGHTS_LABEL = {
  reference_only: "Reference only",
  per_item_license: "Licence per item",
  platform_license: "Platform licence",
} as const;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when `url` is on `sourceUrl`'s domain or a subdomain of it. */
export function isSameSite(url: string, sourceUrl: string): boolean {
  const a = hostOf(url);
  const b = hostOf(sourceUrl);
  return Boolean(a && b && (a === b || a.endsWith(`.${b}`)));
}
