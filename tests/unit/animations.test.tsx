import { renderToStaticMarkup } from "react-dom/server";
import { isCore } from "@/lib/library/curation";
import { describe, expect, it } from "vitest";
import { ANIMATION_CATALOG_TEXT } from "@/lib/animations/catalog-text";
import { bounceDrop, ease } from "@/lib/animations/easing";
import { ANIMATION_PRESETS, getPreset } from "@/lib/animations/presets";
import { RENDERERS } from "@/lib/animations/renderers";
import { defaultsOf, sanitizeParams } from "@/lib/animations/types";

const REQUIRED: Record<string, string[]> = {
  text: ["Typewriter", "Character Stagger", "Word Stagger", "Blur In", "Blur Out", "Split Reveal", "Mask Reveal", "Kinetic Scale", "Slide", "Bounce", "Scramble", "Tracking Reveal", "Line Reveal"],
  image: ["Ken Burns", "Slow Zoom", "Pan", "Parallax", "Image Reveal", "Depth Shift", "Blur Transition"],
  object: ["Float", "Drift", "Bounce", "Elastic", "Rotate", "Scale", "Magnetic", "Follow Path"],
  transition: ["Shape Wipe", "Mask Wipe", "Blur", "Camera Push", "Camera Pull", "Liquid", "Morph", "Pixel", "Grain", "Film", "Light Leak"],
  background: ["Grain", "Noise", "Gradient Flow", "Particle Field", "Grid", "Wave", "Liquid", "Glow", "Mesh"],
  "3d": ["Camera Orbit", "Product Spin", "Depth Tunnel", "3D Particle Field", "3D Parallax", "Object Reveal"],
};

describe("animation library", () => {
  it("contains every requested preset with a unique id", () => {
    for (const [category, names] of Object.entries(REQUIRED)) {
      const present = ANIMATION_PRESETS.filter((p) => p.category === category).map((p) => p.name);
      expect(present).toEqual(expect.arrayContaining(names));
    }
    const ids = ANIMATION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ANIMATION_PRESETS.length).toBeGreaterThanOrEqual(90);
  });

  it("defines a schema, defaults and a known renderer for every preset", () => {
    for (const p of ANIMATION_PRESETS) {
      expect(RENDERERS[p.implementation.renderer], p.id).toBeDefined();
      expect(Object.keys(p.parameters).length, p.id).toBeGreaterThan(0);
      for (const [key, def] of Object.entries(p.parameters)) {
        if (def.type === "number") expect(def.default >= def.min && def.default <= def.max, `${p.id}.${key}`).toBe(true);
        if (def.type === "select") expect(def.options, `${p.id}.${key}`).toContain(def.default);
      }
      // The AI catalog offers only curated presets; legacy ones still render but are never suggested.
      if (isCore(p.id)) expect(ANIMATION_CATALOG_TEXT).toContain(p.id);
      else expect(ANIMATION_CATALOG_TEXT).not.toContain(`${p.id} |`);
    }
  });

  it("renders every preset deterministically at several frames", () => {
    for (const p of ANIMATION_PRESETS) {
      const Renderer = RENDERERS[p.implementation.renderer]!;
      const props = { fps: 30, durationInFrames: p.preview.durationInFrames, width: 640, height: 360, params: defaultsOf(p), config: p.implementation.config ?? {} };
      for (const frame of [0, 15, 45, 89, p.preview.durationInFrames - 1]) {
        const a = renderToStaticMarkup(<Renderer {...props} frame={frame} />);
        expect(a.length, `${p.id}@${frame}`).toBeGreaterThan(20);
        expect(renderToStaticMarkup(<Renderer {...props} frame={frame} />).replace(/_R_[a-z0-9_]+_/gi, "")).toBe(a.replace(/_R_[a-z0-9_]+_/gi, ""));
      }
    }
  });

  it("clamps and filters parameters against the schema", () => {
    const p = getPreset("text-kinetic-scale")!;
    const out = sanitizeParams(p, { duration: 99, easing: "nope", intensity: 40, bogus: 1 });
    expect(out.duration).toBe(4);
    expect(out.easing).toBe(p.parameters.easing!.default);
    expect(out.intensity).toBe(40);
    expect(out).not.toHaveProperty("bogus");
  });

  it("eases from 0 to 1", () => {
    for (const name of ["linear", "easeOut", "easeInOut", "expoOut", "backOut", "spring"]) {
      expect(ease(name, 0)).toBeCloseTo(0, 5);
      expect(ease(name, 1)).toBeCloseTo(1, 2);
    }
    expect(bounceDrop(1)).toBeGreaterThan(0.98);
  });
});
