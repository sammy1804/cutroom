/**
 * Drag payload contract between libraries and the editor canvas/timeline.
 * Library items set this on dragstart; the editor reads it on drop.
 */
export const DRAG_MIME = "application/x-cutroom-item";

export type DragItem =
  | { type: "asset"; id: string; kind: string; url: string | null; name: string }
  | { type: "reference"; id: string; title: string; imageUrl: string | null }
  | { type: "animation"; presetId: string; params: Record<string, unknown>; name: string; customPresetId?: string };

export function setDragItem(event: React.DragEvent, item: DragItem) {
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(item));
  event.dataTransfer.setData("text/plain", "name" in item ? item.name : item.title);
  event.dataTransfer.effectAllowed = "copy";
}

export function readDragItem(event: React.DragEvent): DragItem | null {
  try {
    return JSON.parse(event.dataTransfer.getData(DRAG_MIME)) as DragItem;
  } catch {
    return null;
  }
}

export const storageUrl = (key: string | null | undefined) => (key ? `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}` : null);
