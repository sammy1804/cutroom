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

/** Anything that can be dropped onto a scene in the stack. */
export type Placeable =
  | { kind: "image"; assetId: string; url: string; credit?: string | null }
  | { kind: "lottie"; assetId: string; url: string; credit?: string | null }
  | { kind: "preset"; presetId: string; category: string; params?: Record<string, number | string | boolean> }
  | { kind: "note"; text: string }
  | { kind: "palette"; colors: string[] }
  | { kind: "reference" };

export type PlaceResult = { ok: true; spec: CreativeSpecDoc; elementId: string | null; message: string } | { ok: false; message: string };

/**
 * Turns a board or library item into part of a scene, deterministically:
 * media becomes an element, a text preset animates the scene's text, a
 * background or transition preset sets the scene's, a note becomes a line,
 * a palette restyles the piece. References stay inspiration only.
 */
export function placeOnScene(spec: CreativeSpecDoc, sceneIdValue: string, item: Placeable): PlaceResult {
  const scene = spec.scenes.find((s) => s.id === sceneIdValue);
  if (!scene) return { ok: false, message: "That scene no longer exists." };
  const label = scene.id.replace("scene_", "Scene ");
  const full = scene.elements.length >= 8;
  if (full && (item.kind === "image" || item.kind === "lottie" || item.kind === "note")) return { ok: false, message: `${label} is full (8 layers). Remove one first.` };

  switch (item.kind) {
    case "image":
    case "lottie": {
      const { spec: next, elementId } = addElement(spec, scene.id, item.kind);
      const hasImage = scene.elements.some((e) => e.type === "image");
      const patch: Partial<SpecElement> = { assetId: item.assetId, src: item.url, credit: item.credit ?? undefined };
      if (item.kind === "image") patch.layout = hasImage ? "center" : "fullbleed";
      return { ok: true, spec: updateElement(next, elementId, patch), elementId, message: `${item.kind === "image" ? "Image" : "Animation"} added to ${label}` };
    }
    case "preset": {
      const anim = { presetId: item.presetId, params: item.params ?? {} };
      if (item.category === "background") return { ok: true, spec: updateScene(spec, scene.id, { background: { ...scene.background, preset: anim } }), elementId: null, message: `${label} background set` };
      if (item.category === "transition") {
        if (spec.scenes[spec.scenes.length - 1]?.id === scene.id) return { ok: false, message: "The last scene has nothing to transition into." };
        return { ok: true, spec: updateScene(spec, scene.id, { transition: anim }), elementId: null, message: `Transition out of ${label} set` };
      }
      if (item.category === "text") {
        const target = scene.elements.find((e) => e.type === "headline" || e.type === "subtitle" || e.type === "cta");
        if (target) return { ok: true, spec: updateElement(spec, target.id, { animation: anim }), elementId: target.id, message: `${label} text animation set` };
        if (full) return { ok: false, message: `${label} is full (8 layers). Remove one first.` };
        const { spec: next, elementId } = addElement(spec, scene.id, "headline");
        return { ok: true, spec: updateElement(next, elementId, { animation: anim }), elementId, message: `Headline added to ${label}` };
      }
      if (item.category === "image") {
        const target = scene.elements.find((e) => e.type === "image" || e.type === "lottie" || e.type === "logo");
        if (!target) return { ok: false, message: `${label} has no image to animate yet. Drop an image first.` };
        return { ok: true, spec: updateElement(spec, target.id, { animation: anim }), elementId: target.id, message: `${label} image animation set` };
      }
      return { ok: false, message: "This kind of animation can't be placed in a scene yet." };
    }
    case "note": {
      const text = item.text.trim().slice(0, 240);
      if (!text) return { ok: false, message: "The note is empty." };
      const type = scene.elements.some((e) => e.type === "headline") ? "subtitle" : "headline";
      const { spec: next, elementId } = addElement(spec, scene.id, type);
      return { ok: true, spec: updateElement(next, elementId, { text }), elementId, message: `Note added to ${label} as a ${type}` };
    }
    case "palette": {
      const [background, foreground, accent] = [item.colors[0], item.colors[1] ?? spec.style.foreground, item.colors[2] ?? item.colors[1] ?? spec.style.accent];
      return { ok: true, spec: updateSpec(spec, { style: { ...spec.style, background: background!, foreground, accent } }), elementId: null, message: "Palette applied to the piece" };
    }
    case "reference":
      return { ok: false, message: "References are for direction only; their rights don't allow use in the video." };
  }
}
