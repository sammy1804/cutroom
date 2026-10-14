import { ANIMATION_PRESETS } from "@/lib/animations/presets";
import type { AnimationPreset } from "@/lib/animations/types";
import type { AnimationGroup, TransitionGroup } from "./taxonomy";

/**
 * Which existing presets belong in the curated library, and where. Anything
 * not listed is legacy: it still renders (old specs keep working) but is
 * never offered in the Library, the board drawer or AI recommendations.
 * Decorative backgrounds, emoji-style effects and "tech demo" motion are
 * deliberately left out (docs/LIBRARY-AUDIT.md).
 */

type Place = { group: AnimationGroup; subgroup: string } | { group: "transition"; subgroup: TransitionGroup };

const CORE: Record<string, Place> = {
  // Typography
  "text-mask-reveal": { group: "typography", subgroup: "Entrance" },
  "text-line-reveal": { group: "typography", subgroup: "Entrance" },
  "text-character-stagger": { group: "typography", subgroup: "Entrance" },
  "text-word-stagger": { group: "typography", subgroup: "Entrance" },
  "text-tracking-reveal": { group: "typography", subgroup: "Entrance" },
  "text-split-reveal": { group: "typography", subgroup: "Entrance" },
  "text-blur-in": { group: "typography", subgroup: "Entrance" },
  "text-slide": { group: "typography", subgroup: "Entrance" },
  "text-kinetic-scale": { group: "typography", subgroup: "Kinetic" },
  "text-typewriter": { group: "typography", subgroup: "Kinetic" },
  "text-scramble": { group: "typography", subgroup: "Kinetic" },
  "text-stamp": { group: "typography", subgroup: "Kinetic" },
  "text-highlight-marker": { group: "typography", subgroup: "Editorial" },
  "text-underline-draw": { group: "typography", subgroup: "Editorial" },
  "text-strike-through": { group: "typography", subgroup: "Editorial" },
  "text-blur-out": { group: "typography", subgroup: "Exit" },
  // Image
  "image-slow-zoom": { group: "image", subgroup: "Basic" },
  "image-pan": { group: "image", subgroup: "Basic" },
  "image-ken-burns": { group: "image", subgroup: "Basic" },
  "image-zoom-punch": { group: "image", subgroup: "Basic" },
  "image-parallax": { group: "image", subgroup: "Advanced" },
  "image-depth-shift": { group: "image", subgroup: "Advanced" },
  "image-image-reveal": { group: "image", subgroup: "Advanced" },
  "image-blur-transition": { group: "image", subgroup: "Advanced" },
  "image-duotone": { group: "image", subgroup: "Editorial" },
  "image-cutout-pop": { group: "image", subgroup: "Stop motion" },
  // Object
  "object-float": { group: "object", subgroup: "Movement" },
  "object-drift": { group: "object", subgroup: "Movement" },
  "object-follow-path": { group: "object", subgroup: "Movement" },
  "object-scale": { group: "object", subgroup: "Physical" },
  "object-flip": { group: "object", subgroup: "Physical" },
  // Graphics
  "component-captions-word-pop": { group: "graphics", subgroup: "Captions" },
  "component-captions-karaoke": { group: "graphics", subgroup: "Captions" },
  "component-captions-serif-keyword": { group: "graphics", subgroup: "Captions" },
  "component-captions-two-speaker": { group: "graphics", subgroup: "Captions" },
  "component-lower-third": { group: "graphics", subgroup: "Titles" },
  "component-name-tag": { group: "graphics", subgroup: "Titles" },
  "component-quote-card": { group: "graphics", subgroup: "Titles" },
  "component-chapter-marker": { group: "graphics", subgroup: "Titles" },
  "component-metric-counter": { group: "graphics", subgroup: "Data" },
  "component-progress-bar": { group: "graphics", subgroup: "Data" },
  "component-notification-toast": { group: "graphics", subgroup: "Interface" },
  "component-chat-bubbles": { group: "graphics", subgroup: "Interface" },
  "component-cta-button": { group: "graphics", subgroup: "End" },
  "component-logo-reveal": { group: "graphics", subgroup: "End" },
  "component-end-card": { group: "graphics", subgroup: "End" },
  // Material (backgrounds a designer would use as a surface, not decoration)
  "background-paper": { group: "material", subgroup: "Paper" },
  "background-halftone": { group: "material", subgroup: "Print" },
  "background-grain": { group: "material", subgroup: "Film" },
  // 3D
  "3d-product-spin": { group: "3d", subgroup: "Product" },
  "3d-object-reveal": { group: "3d", subgroup: "Product" },
  "3d-camera-orbit": { group: "3d", subgroup: "Space" },
  "3d-parallax-3d": { group: "3d", subgroup: "Space" },
  // Transitions
  "transition-camera-push": { group: "transition", subgroup: "Cinematic" },
  "transition-camera-pull": { group: "transition", subgroup: "Cinematic" },
  "transition-whip-pan": { group: "transition", subgroup: "Cinematic" },
  "transition-zoom-through": { group: "transition", subgroup: "Cinematic" },
  "transition-blur": { group: "transition", subgroup: "Cinematic" },
  "transition-film": { group: "transition", subgroup: "Physical" },
  "transition-split-doors": { group: "transition", subgroup: "Editorial" },
  "transition-mask-wipe": { group: "transition", subgroup: "Graphic" },
  "transition-shape-wipe": { group: "transition", subgroup: "Graphic" },
  "transition-stripes": { group: "transition", subgroup: "Graphic" },
  "transition-iris": { group: "transition", subgroup: "Graphic" },
  "transition-morph": { group: "transition", subgroup: "Experimental" },
};

export interface CuratedPreset {
  preset: AnimationPreset;
  group: Place["group"];
  subgroup: string;
}

export const isCore = (presetId: string) => presetId in CORE;
export const placeOf = (presetId: string): Place | null => CORE[presetId] ?? null;

/** The curated building blocks, in taxonomy order. */
export const CURATED_PRESETS: CuratedPreset[] = ANIMATION_PRESETS.flatMap((preset) => {
  const place = CORE[preset.id];
  return place ? [{ preset, group: place.group, subgroup: place.subgroup }] : [];
});

export const CURATED_ANIMATIONS = CURATED_PRESETS.filter((c) => c.group !== "transition");
export const CURATED_TRANSITIONS = CURATED_PRESETS.filter((c) => c.group === "transition");

/** Curated presets as plain presets, for pickers and AI catalogs. */
export const LIBRARY_PRESETS: AnimationPreset[] = CURATED_PRESETS.map((c) => c.preset);
