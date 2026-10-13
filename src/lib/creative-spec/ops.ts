import { renumber, sceneId, type CreativeSpecDoc, type SpecElement, type SpecScene } from "./schema";

/** Pure edits on a CreativeSpec. Every edit returns a new spec with sequential, stable ids. */

export function updateSpec(spec: CreativeSpecDoc, patch: Partial<Omit<CreativeSpecDoc, "scenes">>): CreativeSpecDoc {
  return { ...spec, ...patch };
}

export function updateScene(spec: CreativeSpecDoc, id: string, patch: Partial<SpecScene>): CreativeSpecDoc {
  return { ...spec, scenes: spec.scenes.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)) };
}

export function updateElement(spec: CreativeSpecDoc, elementId: string, patch: Partial<SpecElement>): CreativeSpecDoc {
  return {
    ...spec,
    scenes: spec.scenes.map((s) => ({ ...s, elements: s.elements.map((e) => (e.id === elementId ? { ...e, ...patch, id: e.id } : e)) })),
  };
}

export function addScene(spec: CreativeSpecDoc, afterId?: string): CreativeSpecDoc {
  const at = afterId ? spec.scenes.findIndex((s) => s.id === afterId) + 1 : spec.scenes.length;
  const tmp = sceneId(99);
  const scene: SpecScene = {
    id: tmp,
    purpose: "context",
    duration: 2.5,
    background: { color: spec.style.background, preset: null },
    elements: [{ id: `${tmp}.headline`, type: "headline", text: "New scene", layout: "center", size: 64, animation: { presetId: "text-mask-reveal", params: {} } }],
    transition: null,
  };
  const scenes = [...spec.scenes];
  scenes.splice(at, 0, scene);
  return renumber({ ...spec, scenes });
}

export function duplicateScene(spec: CreativeSpecDoc, id: string): CreativeSpecDoc {
  const i = spec.scenes.findIndex((s) => s.id === id);
  if (i < 0) return spec;
  const scenes = [...spec.scenes];
  scenes.splice(i + 1, 0, structuredClone(spec.scenes[i]!));
  return renumber({ ...spec, scenes });
}

export function removeScene(spec: CreativeSpecDoc, id: string): CreativeSpecDoc {
  if (spec.scenes.length <= 1) return spec;
  return renumber({ ...spec, scenes: spec.scenes.filter((s) => s.id !== id) });
}

export function moveScene(spec: CreativeSpecDoc, id: string, delta: -1 | 1): CreativeSpecDoc {
  const i = spec.scenes.findIndex((s) => s.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= spec.scenes.length) return spec;
  const scenes = [...spec.scenes];
  [scenes[i], scenes[j]] = [scenes[j]!, scenes[i]!];
  return renumber({ ...spec, scenes });
}

const DEFAULTS: Record<SpecElement["type"], Omit<SpecElement, "id">> = {
  headline: { type: "headline", text: "Headline", layout: "center", size: 64, animation: { presetId: "text-mask-reveal", params: {} } },
  subtitle: { type: "subtitle", text: "Supporting line", layout: "bottom", size: 30, animation: { presetId: "text-word-stagger", params: { intensity: 30 } } },
  cta: { type: "cta", text: "Learn more", layout: "bottom", size: 32, animation: { presetId: "text-blur-in", params: {} } },
  image: { type: "image", layout: "fullbleed", animation: { presetId: "image-ken-burns", params: {} } },
  logo: { type: "logo", layout: "top", animation: null },
  lottie: { type: "lottie", layout: "center", animation: null },
};

/** Adds an element; ids are `${scene}.${type}`, suffixed when a type repeats (scene_01.headline_2). */
export function addElement(spec: CreativeSpecDoc, sceneIdValue: string, type: SpecElement["type"]): { spec: CreativeSpecDoc; elementId: string } {
  const scene = spec.scenes.find((s) => s.id === sceneIdValue);
  if (!scene) return { spec, elementId: "" };
  let key: string = type;
  for (let n = 2; scene.elements.some((e) => e.id === `${scene.id}.${key}`); n++) key = `${type}_${n}`;
  const elementId = `${scene.id}.${key}`;
  return { spec: updateScene(spec, scene.id, { elements: [...scene.elements, { ...structuredClone(DEFAULTS[type]), id: elementId }] }), elementId };
}

export function removeElement(spec: CreativeSpecDoc, elementId: string): CreativeSpecDoc {
  return { ...spec, scenes: spec.scenes.map((s) => ({ ...s, elements: s.elements.filter((e) => e.id !== elementId) })) };
}

/** Every distinct credit line the piece must carry (CC BY assets and the like). */
export function specCredits(spec: CreativeSpecDoc): string[] {
  return [...new Set(spec.scenes.flatMap((s) => s.elements.map((e) => e.credit?.trim()).filter((c): c is string => Boolean(c))))];
}

export function findElement(spec: CreativeSpecDoc, elementId: string | null) {
  if (!elementId) return null;
  for (const s of spec.scenes) {
    const e = s.elements.find((x) => x.id === elementId);
    if (e) return { scene: s, element: e };
  }
  return null;
}
