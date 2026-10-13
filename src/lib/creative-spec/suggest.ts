import { contrast } from "@/lib/color";
import { addScene, specCredits, updateElement, updateScene } from "./ops";
import type { CreativeSpecDoc } from "./schema";

/**
 * Sous chef suggestions: small, deterministic improvements offered as
 * keep-or-cut cards. Each carries the exact edit it would make, so keeping one
 * applies it instantly with no AI call.
 */
export interface Suggestion {
  id: string;
  title: string;
  why: string;
  target: string;
  apply: (spec: CreativeSpecDoc) => CreativeSpecDoc;
}

export function suggest(spec: CreativeSpecDoc): Suggestion[] {
  const out: Suggestion[] = [];
  const first = spec.scenes[0];
  if (first && first.duration > 3) {
    out.push({ id: `hook-length-${first.duration}`, title: "Tighten the hook to 2 seconds", why: "Viewers decide in the first one or two seconds.", target: first.id, apply: (s) => updateScene(s, first.id, { duration: 2 }) });
  }
  const credits = specCredits(spec);
  const creditLine = credits.join(" · ");
  for (const scene of spec.scenes) {
    // Credit lines are small print, not something people need to read in time.
    const words = scene.elements.filter((e) => e.text && e.text !== creditLine && !credits.includes(e.text)).reduce((n, e) => n + e.text!.split(/\s+/).filter(Boolean).length, 0);
    const need = Math.ceil((words * 0.3 + 0.5) * 2) / 2;
    if (words && need > scene.duration + 0.05) {
      out.push({ id: `read-${scene.id}-${need}`, title: `Give ${scene.id.replace("scene_", "scene ")} ${need}s to read`, why: `${words} words need about ${need}s on screen.`, target: scene.id, apply: (s) => updateScene(s, scene.id, { duration: need }) });
    }
  }
  const gaps = spec.scenes.slice(0, -1).filter((s) => !s.transition);
  if (gaps.length >= 2) {
    out.push({
      id: `transitions-${gaps.length}`,
      title: "Add soft cuts between scenes",
      why: `${gaps.length} scenes hard-cut. A mask wipe keeps the rhythm without drawing attention.`,
      target: "spec",
      apply: (s) => ({ ...s, scenes: s.scenes.map((x, i) => (i < s.scenes.length - 1 && !x.transition ? { ...x, transition: { presetId: "transition-mask-wipe", params: {} } } : x)) }),
    });
  }
  if (!spec.scenes.some((s) => s.purpose === "cta" || s.elements.some((e) => e.type === "cta")) && spec.scenes.length < 24) {
    out.push({
      id: "add-cta",
      title: "End on a call to action",
      why: "The piece never tells people what to do next.",
      target: "spec",
      apply: (s) => {
        const next = addScene(s);
        const last = next.scenes[next.scenes.length - 1]!;
        return updateElement(updateScene(next, last.id, { purpose: "cta" }), last.elements[0]!.id, { type: "cta", text: "Learn more", layout: "center", size: 40 });
      },
    });
  }
  if (contrast(spec.style.foreground, spec.style.background) < 4.5) {
    const light = contrast("#ffffff", spec.style.background) >= contrast("#111111", spec.style.background);
    out.push({ id: `contrast-${spec.style.background}`, title: `Switch text to ${light ? "white" : "near-black"}`, why: "Text is hard to read against the background.", target: "spec", apply: (s) => ({ ...s, style: { ...s.style, foreground: light ? "#ffffff" : "#111111" } }) });
  }
  const last = spec.scenes[spec.scenes.length - 1];
  if (credits.length && last && !last.elements.some((e) => e.text === creditLine)) {
    out.push({
      id: `credits-${creditLine.length}`,
      title: "Put the required credit on the end card",
      why: "A CC BY asset in this piece needs attribution.",
      target: last.id,
      apply: (s) => {
        const l = s.scenes[s.scenes.length - 1]!;
        let key = "subtitle";
        for (let n = 2; l.elements.some((e) => e.id === `${l.id}.${key}`); n++) key = `subtitle_${n}`;
        return updateScene(s, l.id, { elements: [...l.elements, { id: `${l.id}.${key}`, type: "subtitle", text: creditLine.slice(0, 240), layout: "bottom", size: 18, animation: null }] });
      },
    });
  }
  return out;
}
