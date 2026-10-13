import { z } from "zod";
import { animationRefSchema, ASPECT, renumber, sceneSchema, type Aspect, type CreativeSpecDoc, type SpecScene } from "@/lib/creative-spec/schema";

/**
 * The project board. A frame is a scene, connected frames are the video, and
 * the connection carries the transition. Notes, references and palettes are
 * loose thinking material. The video (CreativeSpec) is compiled from the
 * longest connected chain, so the board is the single place people edit.
 * See docs/BOARD.md.
 */

const pos = { id: z.string().min(1).max(40), x: z.number(), y: z.number() };

export const frameSchema = z.object({ ...pos, scene: sceneSchema });

export const linkSchema = z.object({
  id: z.string().min(1).max(40),
  from: z.string(),
  to: z.string(),
  transition: animationRefSchema.nullable().default(null),
});

const size = { w: z.number().min(60).max(1600), h: z.number().min(40).max(1600) };
export const looseItemSchema = z.discriminatedUnion("kind", [
  z.object({ ...pos, ...size, kind: z.literal("note"), text: z.string().max(2000), color: z.string().max(20).default("yellow") }),
  z.object({ ...pos, ...size, kind: z.literal("reference"), referenceId: z.string(), title: z.string().max(300), imageUrl: z.string().nullable(), url: z.string().nullable() }),
  z.object({ ...pos, ...size, kind: z.literal("palette"), colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1).max(8), name: z.string().max(80).default("Palette") }),
]);

export const styleSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  accent: z.string(),
  font: z.enum(["sans", "serif", "mono"]).default("sans"),
});

export const boardSchema = z.object({
  version: z.literal(2),
  title: z.string().max(120),
  aspect: z.enum(["9:16", "1:1", "4:5", "16:9"]),
  style: styleSchema,
  frames: z.array(frameSchema).max(60),
  links: z.array(linkSchema).max(120),
  items: z.array(looseItemSchema).max(300),
});

export type BoardFrame = z.infer<typeof frameSchema>;
export type BoardLink = z.infer<typeof linkSchema>;
export type LooseItem = z.infer<typeof looseItemSchema>;
export type BoardStyle = z.infer<typeof styleSchema>;
export type BoardDoc = z.infer<typeof boardSchema>;
export type Viewport = { x: number; y: number; zoom: number };

export const DEFAULT_STYLE: BoardStyle = { background: "#141210", foreground: "#f3efe7", accent: "#d9732b", font: "sans" };

export const emptyBoard = (title = "Untitled", aspect: Aspect = "9:16"): BoardDoc => ({ version: 2, title, aspect, style: DEFAULT_STYLE, frames: [], links: [], items: [] });

export const NOTE_COLORS: Record<string, { bg: string; fg: string }> = {
  yellow: { bg: "#fbf3db", fg: "#3a2f0b" },
  pink: { bg: "#fbe4e4", fg: "#4a1717" },
  blue: { bg: "#e7f3f8", fg: "#10334a" },
  green: { bg: "#edf3ec", fg: "#1c3a1a" },
  gray: { bg: "#f1f1ef", fg: "#2f2f2f" },
};

export const LOOSE_SIZE: Record<LooseItem["kind"], { w: number; h: number }> = {
  note: { w: 220, h: 160 },
  reference: { w: 280, h: 220 },
  palette: { w: 260, h: 110 },
};

/** On-canvas size of a frame at 100% zoom: a fixed area so every format reads at a glance. */
export function frameSize(aspect: Aspect) {
  const [w, h] = ASPECT[aspect];
  const scale = Math.sqrt(68_000 / (w * h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** A frame's scene keeps a fixed local id; real scene ids are assigned when the chain compiles. */
export const LOCAL_SCENE = "scene_01";

export function blankScene(style: BoardStyle, text = "Your text"): SpecScene {
  return {
    id: LOCAL_SCENE,
    purpose: "context",
    duration: 2.5,
    background: { color: style.background, preset: null },
    elements: [{ id: `${LOCAL_SCENE}.headline`, type: "headline", text, layout: "center", size: 64, animation: { presetId: "text-mask-reveal", params: {} } }],
    transition: null,
  };
}

/* ─── Chains ─────────────────────────────────────────────────────────────── */

/** Every chain of connected frames, in order. A frame with no links is a chain of one. */
export function chains(board: Pick<BoardDoc, "frames" | "links">): string[][] {
  const ids = new Set(board.frames.map((f) => f.id));
  const next = new Map<string, string>();
  const hasPrev = new Set<string>();
  for (const l of board.links) {
    if (!ids.has(l.from) || !ids.has(l.to)) continue;
    next.set(l.from, l.to);
    hasPrev.add(l.to);
  }
  const out: string[][] = [];
  const seen = new Set<string>();
  for (const f of board.frames) {
    if (hasPrev.has(f.id)) continue;
    const chain: string[] = [];
    for (let at: string | undefined = f.id; at && !seen.has(at); at = next.get(at)) {
      seen.add(at);
      chain.push(at);
    }
    out.push(chain);
  }
  return out;
}

/** The video is the longest chain; ties go to the one that starts furthest left. */
export function mainChain(board: Pick<BoardDoc, "frames" | "links">): string[] {
  const x = new Map(board.frames.map((f) => [f.id, f.x]));
  return chains(board).sort((a, b) => b.length - a.length || (x.get(a[0]!) ?? 0) - (x.get(b[0]!) ?? 0))[0] ?? [];
}

/** Whether linking from → to would loop back on itself. */
export function wouldCycle(board: Pick<BoardDoc, "links">, from: string, to: string) {
  const next = new Map(board.links.map((l) => [l.from, l.to]));
  for (let at: string | undefined = to; at; at = next.get(at)) if (at === from) return true;
  return false;
}

/** Compiles the main chain into the CreativeSpec that preview, QC and export read. */
export function compileSpec(board: BoardDoc): CreativeSpecDoc | null {
  const order = mainChain(board);
  if (!order.length) return null;
  const byId = new Map(board.frames.map((f) => [f.id, f]));
  const linkFrom = new Map(board.links.map((l) => [l.from, l]));
  const scenes = order.map((id, i) => {
    const scene = byId.get(id)!.scene;
    const transition = i < order.length - 1 ? (linkFrom.get(id)?.transition ?? null) : null;
    return { ...scene, transition };
  });
  return renumber({ version: 1, title: board.title, aspect: board.aspect, fps: 30, style: board.style, scenes });
}

/** Lays a spec out as a connected row of frames (used for AI drafts, templates and older projects). */
export function boardFromSpec(spec: CreativeSpecDoc, keep?: Pick<BoardDoc, "items">, origin = { x: 0, y: 0 }): BoardDoc {
  const { w } = frameSize(spec.aspect);
  const frames: BoardFrame[] = spec.scenes.map((s, i) => ({
    id: newId("f"),
    x: origin.x + i * (w + 120),
    y: origin.y,
    scene: { ...s, id: LOCAL_SCENE, transition: null, elements: s.elements.map((e) => ({ ...e, id: `${LOCAL_SCENE}.${e.id.split(".")[1]}` })) },
  }));
  const links: BoardLink[] = frames.slice(0, -1).map((f, i) => ({ id: newId("l"), from: f.id, to: frames[i + 1]!.id, transition: spec.scenes[i]!.transition ?? null }));
  return { version: 2, title: spec.title, aspect: spec.aspect, style: spec.style, frames, links, items: keep?.items ?? [] };
}

/** Reads whatever is stored (v1 boards, a spec without a board, nothing) as a v2 board. */
export function loadBoard(raw: unknown, spec: CreativeSpecDoc | null, fallback: { title: string; aspect: string }): BoardDoc {
  const parsed = boardSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const legacy = z.object({ version: z.literal(1), items: z.array(z.record(z.string(), z.unknown())) }).safeParse(raw);
  const items: LooseItem[] = legacy.success ? legacy.data.items.map((i) => looseItemSchema.safeParse(i)).flatMap((r) => (r.success ? [r.data] : [])) : [];
  if (spec) return boardFromSpec(spec, { items }, { x: 0, y: items.length ? Math.max(...items.map((i) => i.y + i.h)) + 80 : 0 });
  const aspect = (Object.keys(ASPECT) as Aspect[]).includes(fallback.aspect as Aspect) ? (fallback.aspect as Aspect) : "9:16";
  return { ...emptyBoard(fallback.title, aspect), items };
}

/**
 * Maps an edited copy of the compiled spec back onto the board: scene i is
 * frame chain[i], transitions are links, extra scenes become new frames
 * connected at the end. Used for Sous chef's one-click fixes.
 */
export function opsFromSpec(board: BoardDoc, next: CreativeSpecDoc): BoardOp[] {
  const chain = mainChain(board);
  const byId = new Map(board.frames.map((f) => [f.id, f]));
  const ops: BoardOp[] = [];
  if (JSON.stringify(next.style) !== JSON.stringify(board.style)) ops.push({ t: "meta", style: next.style });
  const { w } = frameSize(board.aspect);
  const ids = [...chain];
  next.scenes.forEach((scene, i) => {
    const local = { ...scene, id: LOCAL_SCENE, transition: null, elements: scene.elements.map((e) => ({ ...e, id: `${LOCAL_SCENE}.${e.id.split(".")[1]}` })) };
    const existing = ids[i] ? byId.get(ids[i]!) : undefined;
    if (existing) {
      if (JSON.stringify(existing.scene) !== JSON.stringify(local)) ops.push({ t: "frame", frame: { ...existing, scene: local } });
    } else {
      const prev = byId.get(ids[i - 1]!)!;
      const frame = { id: newId("f"), x: prev.x + w + 120, y: prev.y, scene: local };
      byId.set(frame.id, frame);
      ids.push(frame.id);
      ops.push({ t: "frame", frame });
    }
  });
  next.scenes.forEach((scene, i) => {
    if (i >= ids.length - 1) return;
    const link = board.links.find((l) => l.from === ids[i] && l.to === ids[i + 1]);
    const transition = scene.transition ?? null;
    if (!link) ops.push({ t: "link", link: { id: newId("l"), from: ids[i]!, to: ids[i + 1]!, transition } });
    else if (JSON.stringify(link.transition) !== JSON.stringify(transition)) ops.push({ t: "link", link: { ...link, transition } });
  });
  return ops;
}

/* ─── Operations (the unit of live collaboration) ───────────────────────── */

export const boardOpSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("frame"), frame: frameSchema }),
  z.object({ t: z.literal("frame-"), id: z.string() }),
  z.object({ t: z.literal("link"), link: linkSchema }),
  z.object({ t: z.literal("link-"), id: z.string() }),
  z.object({ t: z.literal("item"), item: looseItemSchema }),
  z.object({ t: z.literal("item-"), id: z.string() }),
  z.object({ t: z.literal("meta"), title: z.string().max(120).optional(), aspect: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(), style: styleSchema.optional() }),
  /** Server-only: the whole board was replaced (an AI draft or a template). Clients reload it. */
  z.object({ t: z.literal("reset"), board: boardSchema }),
]);
export type BoardOp = z.infer<typeof boardOpSchema>;

const upsert = <T extends { id: string }>(list: T[], v: T) => (list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v]);

/**
 * Applies whole-entity operations. Each op replaces one frame, link or card,
 * so concurrent edits resolve as last-write-wins per entity. Links keep the
 * board a set of simple chains: one way into and one way out of each frame.
 */
export function applyOps(board: BoardDoc, ops: BoardOp[]): BoardDoc {
  let b = board;
  for (const op of ops) {
    switch (op.t) {
      case "frame":
        b = { ...b, frames: upsert(b.frames, op.frame) };
        break;
      case "frame-":
        b = { ...b, frames: b.frames.filter((f) => f.id !== op.id), links: b.links.filter((l) => l.from !== op.id && l.to !== op.id) };
        break;
      case "link": {
        const { link } = op;
        if (link.from === link.to || !b.frames.some((f) => f.id === link.from) || !b.frames.some((f) => f.id === link.to)) break;
        const others = b.links.filter((l) => l.id !== link.id && l.from !== link.from && l.to !== link.to);
        if (wouldCycle({ links: others }, link.from, link.to)) break;
        b = { ...b, links: [...others, link] };
        break;
      }
      case "link-":
        b = { ...b, links: b.links.filter((l) => l.id !== op.id) };
        break;
      case "item":
        b = { ...b, items: upsert(b.items, op.item) };
        break;
      case "item-":
        b = { ...b, items: b.items.filter((i) => i.id !== op.id) };
        break;
      case "meta":
        b = { ...b, ...(op.title !== undefined && { title: op.title }), ...(op.aspect && { aspect: op.aspect }), ...(op.style && { style: op.style }) };
        break;
      case "reset":
        b = op.board;
        break;
    }
  }
  return b;
}
