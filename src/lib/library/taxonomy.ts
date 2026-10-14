/**
 * The Cutroom library taxonomy (docs/LIBRARY-AUDIT.md). Templates are the
 * primary experience and are organised by creative outcome; animations are
 * the building blocks, organised by what they move.
 */

export const TEMPLATE_CATEGORIES = [
  { id: "product", label: "Product", hint: "Launches, reveals, feature films" },
  { id: "brand", label: "Brand", hint: "Films, manifestos, campaigns" },
  { id: "social", label: "Social", hint: "Reels, stories, posts, hooks" },
  { id: "editorial", label: "Editorial", hint: "Magazine type and image" },
  { id: "stop-motion", label: "Stop Motion", hint: "Frame-by-frame, objects, type" },
  { id: "paper-collage", label: "Paper / Collage", hint: "Cut paper, torn layers, scrapbook" },
  { id: "cinematic", label: "Cinematic", hint: "Teasers, openers, title sequences" },
  { id: "ui-product", label: "UI / Product", hint: "App and SaaS demos" },
  { id: "data", label: "Data", hint: "Numbers, charts, timelines" },
  { id: "events", label: "Events", hint: "Save the date to recap" },
  { id: "experimental", label: "Experimental", hint: "Studies and new directions" },
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["id"];

export const ANIMATION_GROUPS = [
  { id: "typography", label: "Typography", subgroups: ["Entrance", "Kinetic", "Editorial", "Exit"] },
  { id: "image", label: "Image", subgroups: ["Basic", "Advanced", "Editorial", "Stop motion"] },
  { id: "object", label: "Object", subgroups: ["Movement", "Physical"] },
  { id: "shape", label: "Shape", subgroups: ["Draw", "Morph", "Grid"] },
  { id: "camera", label: "Camera", subgroups: ["Move", "Lens"] },
  { id: "graphics", label: "Graphics", subgroups: ["Captions", "Titles", "Data", "Interface", "End"] },
  { id: "material", label: "Material", subgroups: ["Paper", "Print", "Film"] },
  { id: "3d", label: "3D", subgroups: ["Product", "Space"] },
] as const;
export type AnimationGroup = (typeof ANIMATION_GROUPS)[number]["id"];

export const TRANSITION_GROUPS = ["Editorial", "Cinematic", "Physical", "Graphic", "Experimental"] as const;
export type TransitionGroup = (typeof TRANSITION_GROUPS)[number];

export const ASPECTS = ["9:16", "1:1", "4:5", "16:9"] as const;
