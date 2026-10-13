import { z } from "zod";

/**
 * The project board: a free canvas, like Riffle's, where people drop notes,
 * media, motion presets, references and palettes around the piece. Board items
 * are inspiration and raw material; dropping one onto a scene in the stack
 * turns it into part of the CreativeSpec.
 */

const base = { id: z.string().max(40), x: z.number(), y: z.number(), w: z.number().min(60).max(1600), h: z.number().min(40).max(1600) };

export const boardItemSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("note"), text: z.string().max(2000), color: z.string().max(20).default("yellow") }),
  z.object({ ...base, kind: z.literal("image"), assetId: z.string(), url: z.string(), name: z.string().max(200), credit: z.string().max(200).nullable().default(null) }),
  z.object({ ...base, kind: z.literal("lottie"), assetId: z.string(), url: z.string(), thumbnailUrl: z.string().nullable(), name: z.string().max(200), credit: z.string().max(200).nullable().default(null) }),
  z.object({ ...base, kind: z.literal("preset"), presetId: z.string(), params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}), name: z.string().max(120) }),
  z.object({ ...base, kind: z.literal("reference"), referenceId: z.string(), title: z.string().max(300), imageUrl: z.string().nullable(), url: z.string().nullable() }),
  z.object({ ...base, kind: z.literal("palette"), colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)).min(1).max(8), name: z.string().max(80).default("Palette") }),
]);

export const boardSchema = z.object({
  version: z.literal(1),
  items: z.array(boardItemSchema).max(400),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number().min(0.2).max(3) }).default({ x: 0, y: 0, zoom: 1 }),
});

export type BoardItem = z.infer<typeof boardItemSchema>;
export type BoardDoc = z.infer<typeof boardSchema>;
export type BoardItemKind = BoardItem["kind"];

export const emptyBoard = (): BoardDoc => ({ version: 1, items: [], viewport: { x: 0, y: 0, zoom: 1 } });

export const NOTE_COLORS: Record<string, { bg: string; fg: string }> = {
  yellow: { bg: "#fbf3db", fg: "#3a2f0b" },
  pink: { bg: "#fbe4e4", fg: "#4a1717" },
  blue: { bg: "#e7f3f8", fg: "#10334a" },
  green: { bg: "#edf3ec", fg: "#1c3a1a" },
  gray: { bg: "#f1f1ef", fg: "#2f2f2f" },
};

export const DEFAULT_SIZE: Record<BoardItemKind, { w: number; h: number }> = {
  note: { w: 220, h: 160 },
  image: { w: 260, h: 190 },
  lottie: { w: 160, h: 180 },
  preset: { w: 260, h: 190 },
  reference: { w: 280, h: 220 },
  palette: { w: 260, h: 110 },
};

export const newItemId = () => `b_${Math.random().toString(36).slice(2, 10)}`;
