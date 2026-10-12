/**
 * Shared shapes for the creative pipeline:
 * brief → research → references → CreativeDNA → assets → animations → creative spec → editor → render.
 */

/** Licensing record stored with every usable asset. */
export interface AssetRights {
  source: string;
  sourceUrl: string;
  creator: string | null;
  license: string;
  licenseUrl: string | null;
  attributionRequired: boolean;
  commercialUse: boolean;
  modificationAllowed: boolean;
  collectedAt: string;
  /** Plain-language caveats, e.g. "no model release for identifiable people". */
  notes?: string;
}

export interface ReferenceAnalysis {
  summary: string;
  composition: string;
  palette: string[];
  typography: string;
  motion: string;
  artDirection: string;
  photography: string;
  /** What this reference teaches, phrased as reusable direction. */
  learnings: string[];
  sections: { label: string; top: number; bottom: number; why: string }[];
  relevance: number;
  relevanceReason: string;
}

export interface CreativeDNA {
  headline: string;
  dimensions: {
    key: "typography" | "color" | "photography" | "motion" | "composition" | "texture" | "tone";
    direction: string;
    /** Reference ids that support this direction. */
    evidence: string[];
  }[];
  learnedFrom: { referenceId: string; learned: string }[];
  avoid: string[];
  /** Animation preset ids that fit this DNA. */
  suggestedAnimations: string[];
}

export type AnimationRole = "headline" | "body" | "image" | "object" | "transition" | "background";

export interface SpecAnimation {
  id: string;
  role: AnimationRole;
  presetId: string;
  /** Custom preset this came from, if any. */
  customPresetId?: string;
  name: string;
  params: Record<string, unknown>;
}

export interface CreativeSpec {
  animations: SpecAnimation[];
  assets: string[];
}
