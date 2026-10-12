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

/** DIRECTION: a creative territory the project could take. */
export interface CreativeDirection {
  id: string;
  title: string;
  premise: string;
  why: string;
  visualTerritory: string;
  storytelling: string;
  tone: string;
  palette: string[];
  /** Animation preset ids that suit this direction. */
  motion: string[];
  references: string[];
}

/** One exchange in a Brain thread. */
export interface BrainTurn {
  id: string;
  role: "user" | "brain";
  /** What the user asked for: a fresh idea, or a follow-up action. */
  action?: "brainstorm" | "why" | "another" | "research" | "stronger" | "different" | "references";
  text: string;
  directions?: CreativeDirection[];
  /** Brain turns can carry research and challenges, not just directions. */
  insights?: { title: string; detail: string; source?: string }[];
  questions?: string[];
  at: string;
}
