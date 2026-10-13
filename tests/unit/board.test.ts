import { describe, expect, it } from "vitest";
import { applyOps, blankScene, boardFromSpec, boardSchema, compileSpec, emptyBoard, loadBoard, mainChain, opsFromSpec, wouldCycle, type BoardDoc } from "@/lib/board";
import { frameFromDrop, placeOnFrame } from "@/lib/board-place";
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

describe("board model", () => {
  const style = { background: "#141210", foreground: "#f3efe7", accent: "#d9732b", font: "sans" as const };
  const frame = (id: string, x: number, text: string) => ({ id, x, y: 0, scene: blankScene(style, text) });
  const board = (): BoardDoc => ({ ...emptyBoard("Test"), frames: [frame("a", 0, "One"), frame("b", 400, "Two"), frame("c", 800, "Three"), frame("d", 0, "Draft")], links: [] });

  it("compiles the longest connected chain into a valid spec, with transitions from the links", () => {
    let b = applyOps(board(), [
      { t: "link", link: { id: "l1", from: "a", to: "b", transition: { presetId: "transition-mask-wipe", params: {} } } },
      { t: "link", link: { id: "l2", from: "b", to: "c", transition: null } },
    ]);
    expect(mainChain(b)).toEqual(["a", "b", "c"]);
    const spec = compileSpec(b)!;
    expect(() => creativeSpecSchema.parse(spec)).not.toThrow();
    expect(spec.scenes.map((s) => s.id)).toEqual(["scene_01", "scene_02", "scene_03"]);
    expect(spec.scenes.map((s) => s.elements[0]!.text)).toEqual(["One", "Two", "Three"]);
    expect(spec.scenes[0]!.transition?.presetId).toBe("transition-mask-wipe");
    expect(spec.scenes[2]!.transition).toBeNull();
    expect(spec.scenes[1]!.elements[0]!.id).toBe("scene_02.headline");
    // Removing a frame drops its links.
    b = applyOps(b, [{ t: "frame-", id: "b" }]);
    expect(b.links).toHaveLength(0);
  });

  it("keeps chains simple: one link in and out per frame, and no loops", () => {
    let b = applyOps(board(), [
      { t: "link", link: { id: "l1", from: "a", to: "b", transition: null } },
      { t: "link", link: { id: "l2", from: "a", to: "c", transition: null } },
    ]);
    expect(b.links.map((l) => [l.from, l.to])).toEqual([["a", "c"]]);
    b = applyOps(b, [{ t: "link", link: { id: "l3", from: "c", to: "a", transition: null } }]);
    expect(b.links.map((l) => l.id)).toEqual(["l2"]);
    expect(wouldCycle(b, "c", "a")).toBe(true);
  });

  it("lays a spec out as frames and compiles back to the same scenes", () => {
    const original = spec();
    const b = boardFromSpec(original);
    expect(b.frames).toHaveLength(3);
    expect(b.links).toHaveLength(2);
    const round = compileSpec(b)!;
    expect(round.scenes.map((s) => s.elements.map((e) => e.text))).toEqual(original.scenes.map((s) => s.elements.map((e) => e.text)));
  });

  it("drops things onto frames and empty canvas by the documented rules", () => {
    const b = board();
    expect(placeOnFrame(b, "a", { kind: "preset", presetId: "transition-mask-wipe", category: "transition" })).toMatchObject({ ok: false });
    const bg = placeOnFrame(b, "a", { kind: "preset", presetId: "background-grain", category: "background" });
    expect(bg.ok && applyOps(b, bg.ops).frames[0]!.scene.background.preset?.presetId).toBe("background-grain");
    const pal = placeOnFrame(b, "a", { kind: "palette", colors: ["#000000", "#ffffff", "#ff6600"] });
    expect(pal.ok && applyOps(b, pal.ops).style.accent).toBe("#ff6600");
    const f = frameFromDrop(b, { kind: "lottie", assetId: "x", url: "/r.json", credit: "CC BY" }, { x: 100, y: 100 })!;
    expect(f.scene.elements).toEqual([expect.objectContaining({ type: "lottie", src: "/r.json", credit: "CC BY" })]);
    expect(frameFromDrop(b, { kind: "preset", presetId: "transition-mask-wipe", category: "transition" }, { x: 0, y: 0 })).toBeNull();
  });

  it("maps Sous chef fixes back onto frames and links", () => {
    const b = boardFromSpec(spec());
    const fixed = suggest(compileSpec(b)!).find((s) => s.id === "add-cta")!.apply(compileSpec(b)!);
    const after = applyOps(b, opsFromSpec(b, fixed));
    expect(after.frames).toHaveLength(4);
    expect(mainChain(after)).toHaveLength(4);
    expect(compileSpec(after)!.scenes[3]!.purpose).toBe("cta");
  });

  it("validates boards and reads older ones", () => {
    expect(boardSchema.parse(emptyBoard()).frames).toEqual([]);
    expect(loadBoard({ version: 1, items: [{ id: "n1", kind: "note", x: 0, y: 0, w: 200, h: 100, text: "hi", color: "yellow" }] }, spec(), { title: "t", aspect: "9:16" }).frames).toHaveLength(3);
    expect(loadBoard(null, null, { title: "t", aspect: "1:1" }).aspect).toBe("1:1");
  });
});
