"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Palette, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readDragItem, type DragItem } from "@/lib/drag";
import type { BoardDoc, BoardItem } from "@/lib/board";
import { BoardCard } from "./board-card";

type Viewport = BoardDoc["viewport"];

/**
 * Infinite canvas. Wheel or trackpad pans, ⌘/Ctrl + wheel zooms around the
 * pointer, dragging empty space pans, double-click adds a note. Cards move by
 * their header; releasing a card over a scene in the stack places it there.
 */
export function BoardCanvas({
  board,
  canEdit,
  selected,
  onSelect,
  onViewport,
  onItem,
  onRemove,
  onAdd,
  onDropPayload,
  onCardToScene,
  onHoverScene,
}: {
  board: BoardDoc;
  canEdit: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onViewport: (v: Viewport) => void;
  onItem: (id: string, patch: Partial<BoardItem>) => void;
  onRemove: (id: string) => void;
  onAdd: (kind: "note" | "palette", at: { x: number; y: number }) => void;
  onDropPayload: (payload: DragItem, at: { x: number; y: number }) => void;
  onCardToScene: (item: BoardItem, sceneId: string) => void;
  onHoverScene: (sceneId: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const vp = board.viewport;
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOver, setDropOver] = useState(false);

  const toWorld = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const v = vpRef.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };
  const center = () => {
    const r = ref.current!.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  };

  const zoomTo = (zoom: number, anchor?: { x: number; y: number }) => {
    const r = ref.current!.getBoundingClientRect();
    const v = vpRef.current;
    const z = Math.min(3, Math.max(0.2, zoom));
    const ax = anchor ? anchor.x - r.left : r.width / 2;
    const ay = anchor ? anchor.y - r.top : r.height / 2;
    onViewport({ zoom: z, x: ax - ((ax - v.x) * z) / v.zoom, y: ay - ((ay - v.y) * z) / v.zoom });
  };

  const fit = () => {
    const r = ref.current!.getBoundingClientRect();
    if (!board.items.length) return onViewport({ x: 0, y: 0, zoom: 1 });
    const minX = Math.min(...board.items.map((i) => i.x)) - 40;
    const minY = Math.min(...board.items.map((i) => i.y)) - 40;
    const maxX = Math.max(...board.items.map((i) => i.x + i.w)) + 40;
    const maxY = Math.max(...board.items.map((i) => i.y + i.h)) + 40;
    const zoom = Math.min(1.5, Math.max(0.2, Math.min(r.width / (maxX - minX), r.height / (maxY - minY))));
    onViewport({ zoom, x: (r.width - (maxX - minX) * zoom) / 2 - minX * zoom, y: (r.height - (maxY - minY) * zoom) / 2 - minY * zoom });
  };

  // Native wheel listener so we can stop the page from scrolling or browser-zooming.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = vpRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const z = Math.min(3, Math.max(0.2, v.zoom * Math.exp(-e.deltaY * 0.01)));
        const ax = e.clientX - r.left;
        const ay = e.clientY - r.top;
        onViewport({ zoom: z, x: ax - ((ax - v.x) * z) / v.zoom, y: ay - ((ay - v.y) * z) / v.zoom });
      } else {
        onViewport({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onViewport]);

  const panStart = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-board-card],[data-canvas-tools]")) return;
    onSelect(null);
    const start = { px: e.clientX, py: e.clientY, ...vpRef.current };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
    const move = (ev: PointerEvent) => onViewport({ zoom: start.zoom, x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py });
    const up = () => {
      el.style.cursor = "";
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const sceneAt = (x: number, y: number) =>
    (document.elementsFromPoint(x, y).find((n) => (n as HTMLElement).dataset?.sceneDrop) as HTMLElement | undefined)?.dataset.sceneDrop ?? null;

  const moveStart = (item: BoardItem) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(item.id);
    setDragId(item.id);
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, x: item.x, y: item.y };
    let scene: string | null = null;
    const move = (ev: PointerEvent) => {
      const z = vpRef.current.zoom;
      onItem(item.id, { x: Math.round(start.x + (ev.clientX - start.px) / z), y: Math.round(start.y + (ev.clientY - start.py) / z) });
      const s = sceneAt(ev.clientX, ev.clientY);
      if (s !== scene) {
        scene = s;
        onHoverScene(s);
      }
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      setDragId(null);
      onHoverScene(null);
      if (scene) {
        // Placing in a scene copies the card into the piece; the card goes back where it was.
        onItem(item.id, { x: start.x, y: start.y });
        onCardToScene(item, scene);
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };

  const resizeStart = (item: BoardItem) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, w: item.w, h: item.h };
    const move = (ev: PointerEvent) => {
      const z = vpRef.current.zoom;
      onItem(item.id, { w: Math.round(Math.max(80, start.w + (ev.clientX - start.px) / z)), h: Math.round(Math.max(60, start.h + (ev.clientY - start.py) / z)) });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const typing = (e.target as HTMLElement).closest("textarea,input");
    if (typing) return;
    if (canEdit && e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onAdd("note", center());
      return;
    }
    if (!selected || !canEdit) return;
    const item = board.items.find((i) => i.id === selected);
    if (!item) return;
    const step = e.shiftKey ? 50 : 10;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (delta[e.key]) {
      e.preventDefault();
      onItem(item.id, { x: item.x + delta[e.key]![0], y: item.y + delta[e.key]![1] });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove(item.id);
    }
  };

  const grid = 24 * vp.zoom;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={panStart}
      onDoubleClick={(e) => canEdit && !(e.target as HTMLElement).closest("[data-board-card],[data-canvas-tools]") && onAdd("note", toWorld(e.clientX, e.clientY))}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        setDropOver(false);
        const payload = readDragItem(e);
        if (!payload || !canEdit) return;
        e.preventDefault();
        onDropPayload(payload, toWorld(e.clientX, e.clientY));
      }}
      role="application"
      aria-label="Project board. Drag items here from the library. Press N to add a note."
      className="relative min-h-0 flex-1 touch-none overflow-hidden bg-background outline-none"
      style={{
        backgroundImage: "radial-gradient(circle, var(--border) 1.2px, transparent 1.2px)",
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
        boxShadow: dropOver ? "inset 0 0 0 2px var(--tally)" : undefined,
      }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
        {board.items.map((item) => (
          <BoardCard
            key={item.id}
            item={item}
            selected={selected === item.id}
            canEdit={canEdit}
            dragging={dragId === item.id}
            onHandlePointerDown={moveStart(item)}
            onResizePointerDown={resizeStart(item)}
            onSelect={() => onSelect(item.id)}
            onChange={(patch) => onItem(item.id, patch)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </div>

      {board.items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-[46ch] text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">Your board is empty</p>
            <p className="mt-1 text-[15px]">
              Drag motion, animations, textures and references in from the library, or double-click anywhere to write a note. Drop anything onto a scene below to put it in
              the video.
            </p>
          </div>
        </div>
      )}

      <div data-canvas-tools className="absolute top-3 left-3 flex items-center gap-1 rounded-lg bg-card p-1 shadow-card">
        {canEdit && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onAdd("note", center())} aria-label="Add note (N)">
              <StickyNote /> Note
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onAdd("palette", center())} aria-label="Add palette">
              <Palette /> Palette
            </Button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          </>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(vp.zoom / 1.25)} aria-label="Zoom out">
          <Minus />
        </Button>
        <button onClick={() => zoomTo(1)} className="tabular w-12 rounded text-center text-[13px] text-muted-foreground hover:bg-hover" aria-label="Reset zoom to 100%">
          {Math.round(vp.zoom * 100)}%
        </button>
        <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(vp.zoom * 1.25)} aria-label="Zoom in">
          <Plus />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Fit board to screen">
          <Maximize />
        </Button>
      </div>
    </div>
  );
}
