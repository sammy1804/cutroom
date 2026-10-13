import { describe, expect, it } from "vitest";
import { boardSchema, emptyBoard } from "@/lib/board";
import { placeOnScene } from "@/lib/creative-spec/ops";
import { creativeSpecSchema, type CreativeSpecDoc } from "@/lib/creative-spec/schema";
import { suggest } from "@/lib/creative-spec/suggest";

const spec = (): CreativeSpecDoc =>
  creativeSpecSchema.parse({
    version: 1,
    title: "t",
    aspect: "9:16",
    fps: 30,
    style: { background: "#141210", foreground: "#f3efe7", accent: "#d9732b" },
    scenes: [
      { id: "scene_01", purpose: "hook", duration: 4, elements: [{ id: "scene_01.headline", type: "headline", text: "Waste is a material" }] },
      { id: "scene_02", purpose: "turn", duration: 2, elements: [] },
      { id: "scene_03", purpose: "payoff", duration: 2, elements: [] },
    ],
  });

const ok = (r: ReturnType<typeof placeOnScene>) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe("placing board items into scenes", () => {
  it("adds media as elements with their credit", () => {
    const r = ok(placeOnScene(spec(), "scene_02", { kind: "lottie", assetId: "a1", url: "/x.json", credit: "Animated Noto Emoji by Google, CC BY 4.0" }));
    expect(r.elementId).toBe("scene_02.lottie");
    expect(r.spec.scenes[1]!.elements[0]).toMatchObject({ type: "lottie", src: "/x.json", credit: expect.stringContaining("CC BY") });
    const img = ok(placeOnScene(r.spec, "scene_02", { kind: "image", assetId: "a2", url: "/x.jpg" }));
    expect(img.spec.scenes[1]!.elements.find((e) => e.type === "image")?.layout).toBe("fullbleed");
  });

  it("routes presets by category", () => {
    const text = ok(placeOnScene(spec(), "scene_01", { kind: "preset", presetId: "text-blur-in", category: "text" }));
    expect(text.spec.scenes[0]!.elements[0]!.animation?.presetId).toBe("text-blur-in");
    const bg = ok(placeOnScene(spec(), "scene_02", { kind: "preset", presetId: "background-grain", category: "background" }));
    expect(bg.spec.scenes[1]!.background.preset?.presetId).toBe("background-grain");
    const tr = ok(placeOnScene(spec(), "scene_01", { kind: "preset", presetId: "transition-mask-wipe", category: "transition" }));
    expect(tr.spec.scenes[0]!.transition?.presetId).toBe("transition-mask-wipe");
    expect(placeOnScene(spec(), "scene_03", { kind: "preset", presetId: "transition-mask-wipe", category: "transition" }).ok).toBe(false);
    expect(placeOnScene(spec(), "scene_02", { kind: "preset", presetId: "image-ken-burns", category: "image" }).ok).toBe(false);
  });

  it("turns notes into lines and palettes into style, and keeps references out", () => {
    const n = ok(placeOnScene(spec(), "scene_01", { kind: "note", text: "Build it again" }));
    expect(n.spec.scenes[0]!.elements[1]).toMatchObject({ type: "subtitle", text: "Build it again" });
    const p = ok(placeOnScene(spec(), "scene_01", { kind: "palette", colors: ["#000000", "#ffffff", "#ff6600"] }));
    expect(p.spec.style).toMatchObject({ background: "#000000", foreground: "#ffffff", accent: "#ff6600" });
    expect(placeOnScene(spec(), "scene_01", { kind: "reference" })).toMatchObject({ ok: false, message: expect.stringContaining("direction only") });
  });

  it("keeps every result a valid spec", () => {
    let s = spec();
    for (let i = 0; i < 10; i++) {
      const r = placeOnScene(s, "scene_02", { kind: "note", text: `line ${i}` });
      if (r.ok) s = r.spec;
    }
    expect(s.scenes[1]!.elements).toHaveLength(8);
    expect(() => creativeSpecSchema.parse(s)).not.toThrow();
  });
});

describe("sous chef", () => {
  it("offers deterministic fixes that produce valid specs", () => {
    const s = ok(placeOnScene(spec(), "scene_02", { kind: "lottie", assetId: "a1", url: "/x.json", credit: "Animated Noto Emoji by Google, CC BY 4.0" })).spec;
    const ideas = suggest(s);
    expect(ideas.map((i) => i.title)).toEqual(expect.arrayContaining(["Tighten the hook to 2 seconds", "Add soft cuts between scenes", "End on a call to action", "Put the required credit on the end card"]));
    for (const idea of ideas) expect(() => creativeSpecSchema.parse(idea.apply(s))).not.toThrow();
    const fixed = ideas.reduce((acc, i) => i.apply(acc), s);
    expect(suggest(fixed).map((i) => i.id)).not.toContain("add-cta");
  });
});

describe("board schema", () => {
  it("accepts an empty board and rejects bad colours", () => {
    expect(boardSchema.parse(emptyBoard()).items).toEqual([]);
    expect(boardSchema.safeParse({ version: 1, items: [{ id: "b1", kind: "palette", x: 0, y: 0, w: 200, h: 100, colors: ["red"] }] }).success).toBe(false);
  });
});
