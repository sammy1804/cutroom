import { blankScene, frameSize, LOCAL_SCENE, newId, type BoardDoc, type BoardFrame, type BoardOp } from "@/lib/board";
import { addElement, placeOnScene, updateElement, type Placeable } from "@/lib/creative-spec/ops";
import type { CreativeSpecDoc } from "@/lib/creative-spec/schema";

/** A one-scene spec around a frame, so the spec editing helpers work on frames too. */
export function frameSpec(board: BoardDoc, frame: BoardFrame): CreativeSpecDoc {
  return { version: 1, title: board.title, aspect: board.aspect, fps: 30, style: board.style, scenes: [frame.scene] };
}

export type PlaceOutcome = { ok: true; ops: BoardOp[]; message: string; frameId: string } | { ok: false; message: string };

/** Drops something onto an existing frame (see docs/BOARD.md, "What happens when you drag things in"). */
export function placeOnFrame(board: BoardDoc, frameId: string, item: Placeable): PlaceOutcome {
  const frame = board.frames.find((f) => f.id === frameId);
  if (!frame) return { ok: false, message: "That frame no longer exists." };
  if (item.kind === "preset" && item.category === "transition") return { ok: false, message: "Transitions go on the arrow between two frames. Click an arrow to choose one." };
  if (item.kind === "palette") {
    const [background, foreground, accent] = [item.colors[0]!, item.colors[1] ?? board.style.foreground, item.colors[2] ?? item.colors[1] ?? board.style.accent];
    const style = { ...board.style, background, foreground, accent };
    // Frames that used the old background follow the new one.
    const ops: BoardOp[] = board.frames
      .filter((f) => f.scene.background.color === board.style.background)
      .map((f) => ({ t: "frame", frame: { ...f, scene: { ...f.scene, background: { ...f.scene.background, color: background } } } }));
    return { ok: true, ops: [{ t: "meta", style }, ...ops], message: "Palette applied to the whole video", frameId };
  }
  const res = placeOnScene(frameSpec(board, frame), LOCAL_SCENE, item);
  if (!res.ok) return res;
  return { ok: true, ops: [{ t: "frame", frame: { ...frame, scene: res.spec.scenes[0]! } }], message: res.message.replace("Scene 01", "the frame"), frameId };
}

/** Drops something onto empty canvas: anything that can be in a video becomes a new frame there. */
export function frameFromDrop(board: BoardDoc, item: Placeable, at: { x: number; y: number }): BoardFrame | null {
  const { w, h } = frameSize(board.aspect);
  const base: BoardFrame = { id: newId("f"), x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), scene: blankScene(board.style) };
  const spec = frameSpec(board, base);
  switch (item.kind) {
    case "image":
    case "lottie": {
      const added = addElement({ ...spec, scenes: [{ ...base.scene, elements: [] }] }, LOCAL_SCENE, item.kind);
      const s = updateElement(added.spec, added.elementId, { assetId: item.assetId, src: item.url, credit: item.credit ?? undefined, layout: item.kind === "image" ? "fullbleed" : "center" });
      return { ...base, scene: s.scenes[0]! };
    }
    case "preset": {
      if (item.category === "transition" || item.category === "image") return null;
      const res = placeOnScene(spec, LOCAL_SCENE, item);
      return res.ok ? { ...base, scene: res.spec.scenes[0]! } : null;
    }
    case "note": {
      const text = item.text.trim().slice(0, 240);
      return text ? { ...base, scene: blankScene(board.style, text) } : null;
    }
    default:
      return null;
  }
}
