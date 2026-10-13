"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Maximize, MessageCirclePlus, Minus, MousePointer2, Palette, Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readDragItem, type DragItem } from "@/lib/drag";
import { blankScene, frameSize, LOOSE_SIZE, mainChain, newId, wouldCycle, type BoardDoc, type BoardOp, type LooseItem, type Viewport } from "@/lib/board";
import { placeOnFrame } from "@/lib/board-place";
import type { CommentView } from "@/server/services/board";
import { cn } from "@/lib/utils";
import { BoardCard } from "./board-card";
import { CommentPin, ThreadCard, threadPoint, type Thread } from "./comments";
import { FrameEditor } from "./frame-editor";
import { FrameNode } from "./frame-node";
import type { DrawerAsset } from "./library-drawer";
import { FRAME_HEADER, LinksLayer, portPoints } from "./links-layer";
import type { Peer } from "./use-board-sync";

export type Mode = "select" | "comment";

/**
 * The board canvas. Frames are scenes; dragging from a frame's right dot to
 * another frame connects them into the video. Wheel pans, ⌘/Ctrl + wheel
 * zooms, dragging empty space pans. Keys: F frame, N note, C comment,
 * Delete removes, arrows nudge, Esc deselects.
 */
export function BoardCanvas({
  slug,
  projectId,
  board,
  commit,
  canEdit,
  viewport,
  setViewport,
  selected,
  setSelected,
  mode,
  setMode,
  peers,
  threads,
  openThread,
  setOpenThread,
  me,
  canModerate,
  assets,
  setCursor,
  onDropPayload,
  onCommentSaved,
  onCommentDeleted,
}: {
  slug: string;
  projectId: string;
  board: BoardDoc;
  commit: (ops: BoardOp[]) => void;
  canEdit: boolean;
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  peers: Peer[];
  threads: Thread[];
  openThread: string | null;
  setOpenThread: (id: string | null) => void;
  me: string;
  canModerate: boolean;
  assets: DrawerAsset[];
  setCursor: (c: { x: number; y: number } | null) => void;
  onDropPayload: (payload: DragItem, at: { x: number; y: number }, frameId: string | null) => void;
  onCommentSaved: (c: CommentView) => void;
  onCommentDeleted: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const vpRef = useRef(viewport);
  vpRef.current = viewport;
  const boardRef = useRef(board);
  boardRef.current = board;
  const [hover, setHover] = useState<string | null>(null);
  const [dropFrame, setDropFrame] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<{ from: string; to: { x: number; y: number } } | null>(null);
  const [composer, setComposer] = useState<{ frameId: string | null; x: number; y: number } | null>(null);
  const [focusText, setFocusText] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const fsize = frameSize(board.aspect);

  const chain = useMemo(() => mainChain(board), [board]);
  const indexOf = useMemo(() => new Map(chain.map((id, i) => [id, i + 1])), [chain]);
  const peerSel = useMemo(() => new Map(peers.filter((p) => p.selection).map((p) => [p.selection!, p.color])), [peers]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const v = vpRef.current;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }, []);
  const toScreen = (p: { x: number; y: number }) => ({ x: viewport.x + p.x * viewport.zoom, y: viewport.y + p.y * viewport.zoom });
  const center = () => toWorld(ref.current!.getBoundingClientRect().left + size.w / 2, ref.current!.getBoundingClientRect().top + size.h / 2);
  const frameAt = (x: number, y: number, except?: string) =>
    (document.elementsFromPoint(x, y).map((n) => (n as HTMLElement).dataset?.frameDrop).find((id) => id && id !== except) as string | undefined) ?? null;

  const zoomTo = (zoom: number) => {
    const v = vpRef.current;
    const z = Math.min(3, Math.max(0.15, zoom));
    const ax = size.w / 2;
    const ay = size.h / 2;
    setViewport({ zoom: z, x: ax - ((ax - v.x) * z) / v.zoom, y: ay - ((ay - v.y) * z) / v.zoom });
  };
  const fit = useCallback(() => {
    const b = boardRef.current;
    const boxes = [...b.frames.map((f) => ({ x: f.x, y: f.y, w: fsize.w, h: fsize.h + FRAME_HEADER })), ...b.items];
    if (!boxes.length) return setViewport({ x: size.w / 2 - fsize.w / 2, y: size.h / 2 - fsize.h / 2, zoom: 1 });
    const minX = Math.min(...boxes.map((i) => i.x)) - 60;
    const minY = Math.min(...boxes.map((i) => i.y)) - 60;
    const maxX = Math.max(...boxes.map((i) => i.x + i.w)) + 60;
    const maxY = Math.max(...boxes.map((i) => i.y + i.h)) + 60;
    const zoom = Math.min(1, Math.max(0.3, Math.min(size.w / (maxX - minX), size.h / (maxY - minY))));
    setViewport({ zoom, x: (size.w - (maxX - minX) * zoom) / 2 - minX * zoom, y: (size.h - (maxY - minY) * zoom) / 2 - minY * zoom });
  }, [fsize.w, fsize.h, setViewport, size.w, size.h]);

  // Native wheel listener so the page doesn't scroll or browser-zoom.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[role=dialog]")) return;
      e.preventDefault();
      const v = vpRef.current;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const z = Math.min(3, Math.max(0.15, v.zoom * Math.exp(-e.deltaY * 0.01)));
        const ax = e.clientX - r.left;
        const ay = e.clientY - r.top;
        setViewport({ zoom: z, x: ax - ((ax - v.x) * z) / v.zoom, y: ay - ((ay - v.y) * z) / v.zoom });
      } else setViewport({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  /** Generic pointer drag with capture; `move` gets world-space deltas. */
  const drag = (e: React.PointerEvent, move: (dx: number, dy: number, ev: PointerEvent) => void, up?: (ev: PointerEvent, moved: boolean) => void) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 3) moved = true;
      const z = vpRef.current.zoom;
      move((ev.clientX - start.x) / z, (ev.clientY - start.y) / z, ev);
    };
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      up?.(ev, moved);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-board-node],[data-canvas-tools]")) return;
    if (mode === "comment") {
      const p = toWorld(e.clientX, e.clientY);
      setComposer({ frameId: null, ...p });
      setOpenThread(null);
      return;
    }
    setSelected(null);
    setOpenThread(null);
    setComposer(null);
    const v0 = { ...vpRef.current };
    const el = e.currentTarget as HTMLElement;
    el.style.cursor = "grabbing";
    drag(
      e,
      (dx, dy) => setViewport({ ...v0, x: v0.x + dx * v0.zoom, y: v0.y + dy * v0.zoom }),
      () => (el.style.cursor = ""),
    );
  };

  const moveFrame = (id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (mode === "comment") return;
    setSelected(id);
    const f = boardRef.current.frames.find((x) => x.id === id);
    if (!f) return;
    const start = { x: f.x, y: f.y };
    drag(e, (dx, dy) => {
      const cur = boardRef.current.frames.find((x) => x.id === id);
      if (cur) commit([{ t: "frame", frame: { ...cur, x: Math.round(start.x + dx), y: Math.round(start.y + dy) } }]);
    });
  };

  const startLink = (id: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const f = boardRef.current.frames.find((x) => x.id === id)!;
    const a = portPoints(boardRef.current, f, f).a;
    setLinkDraft({ from: id, to: a });
    drag(
      e,
      (_dx, _dy, ev) => {
        setLinkDraft({ from: id, to: toWorld(ev.clientX, ev.clientY) });
        setDropFrame(frameAt(ev.clientX, ev.clientY, id));
      },
      (ev) => {
        setLinkDraft(null);
        setDropFrame(null);
        const to = frameAt(ev.clientX, ev.clientY, id);
        if (!to) return;
        const b = boardRef.current;
        const others = b.links.filter((l) => l.from !== id && l.to !== to);
        if (wouldCycle({ links: others }, id, to)) return void toast.error("That would loop the video back on itself.");
        const existing = b.links.find((l) => l.from === id && l.to === to);
        commit([{ t: "link", link: existing ?? { id: newId("l"), from: id, to, transition: null } }]);
        toast.success("Connected. Click the label on the arrow to pick a transition.");
      },
    );
  };

  const moveItem = (item: LooseItem) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(item.id);
    const start = { x: item.x, y: item.y };
    drag(
      e,
      (dx, dy, ev) => {
        const cur = boardRef.current.items.find((x) => x.id === item.id);
        if (cur) commit([{ t: "item", item: { ...cur, x: Math.round(start.x + dx), y: Math.round(start.y + dy) } }]);
        setDropFrame(item.kind === "reference" ? null : frameAt(ev.clientX, ev.clientY));
      },
      (ev) => {
        setDropFrame(null);
        const target = frameAt(ev.clientX, ev.clientY);
        if (!target) return;
        const cur = boardRef.current.items.find((x) => x.id === item.id)!;
        commit([{ t: "item", item: { ...cur, x: start.x, y: start.y } }]);
        if (cur.kind === "reference") return void toast.error("References are for direction only; their rights don't allow use in the video.");
        const res = placeOnFrame(boardRef.current, target, cur.kind === "note" ? { kind: "note", text: cur.text } : { kind: "palette", colors: cur.kind === "palette" ? cur.colors : [] });
        if (!res.ok) return void toast.error(res.message);
        commit(res.ops);
        setSelected(target);
        toast.success(res.message);
      },
    );
  };

  const resizeItem = (item: LooseItem) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { w: item.w, h: item.h };
    drag(e, (dx, dy) => {
      const cur = boardRef.current.items.find((x) => x.id === item.id);
      if (cur) commit([{ t: "item", item: { ...cur, w: Math.round(Math.max(100, start.w + dx)), h: Math.round(Math.max(70, start.h + dy)) } }]);
    });
  };

  const addFrame = () => {
    const b = boardRef.current;
    const last = b.frames.find((f) => f.id === chain[chain.length - 1]);
    const at = last ? { x: last.x + fsize.w + 120, y: last.y } : (() => { const c = center(); return { x: Math.round(c.x - fsize.w / 2), y: Math.round(c.y - fsize.h / 2) }; })();
    const frame = { id: newId("f"), ...at, scene: blankScene(b.style) };
    const ops: BoardOp[] = [{ t: "frame", frame }];
    if (last) ops.push({ t: "link", link: { id: newId("l"), from: last.id, to: frame.id, transition: null } });
    commit(ops);
    setSelected(frame.id);
    setFocusText(true);
  };

  const addLoose = (kind: "note" | "palette", at = center()) => {
    const s = LOOSE_SIZE[kind];
    const base = { id: newId("i"), x: Math.round(at.x - s.w / 2), y: Math.round(at.y - s.h / 2), ...s };
    const st = boardRef.current.style;
    const item: LooseItem =
      kind === "note" ? { ...base, kind: "note", text: "", color: "yellow" } : { ...base, kind: "palette", name: "Palette", colors: [st.background, st.foreground, st.accent].map((c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#888888")) };
    commit([{ t: "item", item }]);
    setSelected(item.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const b = boardRef.current;
    if (b.frames.some((f) => f.id === selected)) commit([{ t: "frame-", id: selected }]);
    else if (b.items.some((i) => i.id === selected)) commit([{ t: "item-", id: selected }]);
    setSelected(null);
  };

  const duplicateFrame = (id: string) => {
    const f = boardRef.current.frames.find((x) => x.id === id);
    if (!f) return;
    const copy = { ...structuredClone(f), id: newId("f"), x: f.x + 40, y: f.y + fsize.h + FRAME_HEADER + 60 };
    commit([{ t: "frame", frame: copy }]);
    setSelected(copy.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("textarea,input,select,[role=dialog],[role=menu]")) return;
    const k = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === "escape") {
      setSelected(null);
      setComposer(null);
      setOpenThread(null);
      setMode("select");
    } else if (k === "c") setMode(mode === "comment" ? "select" : "comment");
    else if (canEdit && k === "n") addLoose("note");
    else if (canEdit && k === "f") addFrame();
    else if (canEdit && selected && (k === "delete" || k === "backspace")) {
      e.preventDefault();
      removeSelected();
    } else if (canEdit && selected && k.startsWith("arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : 10;
      const [dx, dy] = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k] ?? [0, 0];
      const b = boardRef.current;
      const f = b.frames.find((x) => x.id === selected);
      const it = b.items.find((x) => x.id === selected);
      if (f) commit([{ t: "frame", frame: { ...f, x: f.x + dx!, y: f.y + dy! } }]);
      if (it) commit([{ t: "item", item: { ...it, x: it.x + dx!, y: it.y + dy! } }]);
    }
  };

  // Fit the board once on first paint.
  const fitted = useRef(false);
  useEffect(() => {
    // Wait for a real measurement; a saved view (restored by the studio) is kept as is.
    if (!fitted.current && size.w > 100 && size.h > 100) {
      fitted.current = true;
      if (viewport.x === 0 && viewport.y === 0 && viewport.zoom === 1) fit();
    }
  }, [size.w, size.h, fit, viewport]);

  const selectedFrame = board.frames.find((f) => f.id === selected) ?? null;
  const editorStyle = (() => {
    if (!selectedFrame) return {};
    const tl = toScreen({ x: selectedFrame.x, y: selectedFrame.y });
    const right = tl.x + fsize.w * viewport.zoom + 18;
    const left = right + 300 > size.w - 8 ? Math.max(8, tl.x - 318) : right;
    return { left, top: Math.min(Math.max(12, tl.y), Math.max(12, size.h - 420)) };
  })();
  const openT = threads.find((t) => t.root.id === openThread) ?? null;
  const cardStyle = (p: { x: number; y: number }) => {
    const s = toScreen(p);
    return { left: Math.min(Math.max(8, s.x + 20), size.w - 308), top: Math.min(Math.max(8, s.y - 20), Math.max(8, size.h - 360)) };
  };
  const grid = 24 * viewport.zoom;

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onBackgroundDown}
      onPointerMove={(e) => setCursor(toWorld(e.clientX, e.clientY))}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={(e) => {
        if (!canEdit || mode !== "select" || (e.target as HTMLElement).closest("[data-board-node],[data-canvas-tools]")) return;
        addLoose("note", toWorld(e.clientX, e.clientY));
      }}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropFrame(frameAt(e.clientX, e.clientY));
      }}
      onDragLeave={(e) => !ref.current?.contains(e.relatedTarget as Node) && setDropFrame(null)}
      onDrop={(e) => {
        const target = frameAt(e.clientX, e.clientY);
        setDropFrame(null);
        const payload = readDragItem(e);
        if (!payload || !canEdit) return;
        e.preventDefault();
        onDropPayload(payload, toWorld(e.clientX, e.clientY), target);
      }}
      role="application"
      aria-label="Project board. Frames are scenes; connect them to make the video. Keys: F new frame, N note, C comment."
      className={cn("relative min-h-0 flex-1 touch-none overflow-hidden bg-background outline-none", mode === "comment" && "cursor-crosshair")}
      style={{ backgroundImage: "radial-gradient(circle, var(--border) 1.2px, transparent 1.2px)", backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        {board.items.map((item) => (
          <BoardCard
            key={item.id}
            item={item}
            selected={selected === item.id}
            canEdit={canEdit}
            dragging={false}
            onHandlePointerDown={moveItem(item)}
            onResizePointerDown={resizeItem(item)}
            onSelect={() => setSelected(item.id)}
            onChange={(patch) => commit([{ t: "item", item: { ...item, ...patch } as LooseItem }])}
            onRemove={() => commit([{ t: "item-", id: item.id }])}
          />
        ))}
        <LinksLayer
          board={board}
          canEdit={canEdit}
          draft={linkDraft ? { a: portPoints(board, board.frames.find((f) => f.id === linkDraft.from)!, { x: 0, y: 0 }).a, b: linkDraft.to } : null}
          onTransition={(link, presetId) => commit([{ t: "link", link: { ...link, transition: presetId ? { presetId, params: {} } : null } }])}
          onRemove={(link) => commit([{ t: "link-", id: link.id }])}
        />
        {board.frames.map((f) => (
          <FrameNode
            key={f.id}
            board={board}
            frame={f}
            index={indexOf.get(f.id) ?? null}
            selected={selected === f.id}
            playing={selected === f.id || hover === f.id}
            peerColor={peerSel.get(f.id) ?? null}
            dropHot={dropFrame === f.id}
            canEdit={canEdit}
            onHandlePointerDown={moveFrame(f.id)}
            onPortPointerDown={startLink(f.id)}
            onSelect={() => {
              if (mode === "comment") return;
              setSelected(f.id);
              setFocusText(false);
            }}
            onHover={(on) => setHover(on ? f.id : null)}
          />
        ))}
        {threads
          .filter((t) => !t.root.resolved || t.root.id === openThread)
          .map((t) => {
            const p = threadPoint(board, t.root);
            return (
              <div key={t.root.id} className="absolute" style={{ left: p.x, top: p.y }}>
                <CommentPin thread={t} active={openThread === t.root.id} zoom={viewport.zoom} onOpen={() => (setOpenThread(t.root.id), setComposer(null))} />
              </div>
            );
          })}
      </div>

      {/* Mode overlay: in comment mode, clicking a frame pins the comment to it. */}
      {mode === "comment" && (
        <div
          className="absolute inset-0 z-10"
          onPointerDown={(e) => {
            e.stopPropagation();
            const p = toWorld(e.clientX, e.clientY);
            const fid = (() => {
              const el = e.currentTarget as HTMLElement;
              el.style.pointerEvents = "none";
              const id = frameAt(e.clientX, e.clientY);
              el.style.pointerEvents = "";
              return id;
            })();
            const f = fid ? board.frames.find((x) => x.id === fid) : null;
            setComposer(f ? { frameId: f.id, x: p.x - f.x, y: p.y - f.y } : { frameId: null, ...p });
            setOpenThread(null);
          }}
        />
      )}

      {peers.map((p) =>
        p.cursor ? (
          <div key={p.clientId} className="pointer-events-none absolute z-20 transition-[left,top] duration-300 ease-out" style={{ left: toScreen(p.cursor).x, top: toScreen(p.cursor).y }} aria-hidden>
            <MousePointer2 className="size-5 -translate-x-0.5 -translate-y-0.5 drop-shadow" style={{ color: p.color, fill: p.color }} />
            <span className="ml-3 rounded-md px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap text-white shadow" style={{ background: p.color }}>
              {p.name}
            </span>
          </div>
        ) : null,
      )}

      {selectedFrame && mode === "select" && (
        <FrameEditor
          key={selectedFrame.id}
          board={board}
          frame={selectedFrame}
          index={indexOf.get(selectedFrame.id) ?? null}
          assets={assets}
          canEdit={canEdit}
          autoFocusText={focusText}
          commit={commit}
          onClose={() => setSelected(null)}
          onDuplicate={() => duplicateFrame(selectedFrame.id)}
          onDelete={removeSelected}
          style={editorStyle}
        />
      )}

      {composer && (
        <ThreadCard
          slug={slug}
          projectId={projectId}
          thread={null}
          anchor={composer}
          me={me}
          canModerate={canModerate}
          onSaved={(c) => {
            onCommentSaved(c);
            setComposer(null);
            setOpenThread(c.id);
            setMode("select");
          }}
          onDeleted={onCommentDeleted}
          onClose={() => setComposer(null)}
          style={cardStyle(threadPoint(board, composer))}
        />
      )}
      {openT && !composer && (
        <ThreadCard
          key={openT.root.id}
          slug={slug}
          projectId={projectId}
          thread={openT}
          anchor={null}
          me={me}
          canModerate={canModerate}
          onSaved={onCommentSaved}
          onDeleted={onCommentDeleted}
          onClose={() => setOpenThread(null)}
          style={cardStyle(threadPoint(board, openT.root))}
        />
      )}

      {board.frames.length === 0 && board.items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-[44ch] text-center">
            <Clapperboard className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-lg font-medium">Start with a frame</p>
            <p className="mt-1 text-[15px] text-muted-foreground">
              A frame is one scene. Drag an animation, image or texture in from the library, or press <kbd className="rounded border px-1">F</kbd>. Connect frames to make the video.
            </p>
          </div>
        </div>
      )}

      <div data-canvas-tools className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-card p-1 shadow-card ring-1 ring-black/5">
        <ToolButton active={mode === "select"} onClick={() => setMode("select")} label="Select and move (Esc)">
          <MousePointer2 />
        </ToolButton>
        {canEdit && (
          <>
            <Button variant="ghost" size="sm" onClick={addFrame} title="Add a frame after the video (F)">
              <Plus /> Frame
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => addLoose("note")} aria-label="Add note (N)" title="Note (N)">
              <StickyNote />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => addLoose("palette")} aria-label="Add palette" title="Palette">
              <Palette />
            </Button>
          </>
        )}
        <ToolButton active={mode === "comment"} onClick={() => setMode(mode === "comment" ? "select" : "comment")} label="Comment (C)">
          <MessageCirclePlus />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(viewport.zoom / 1.25)} aria-label="Zoom out">
          <Minus />
        </Button>
        <button onClick={() => zoomTo(1)} className="tabular w-11 rounded text-center text-[12px] text-muted-foreground hover:bg-hover" aria-label="Reset zoom to 100%">
          {Math.round(viewport.zoom * 100)}%
        </button>
        <Button variant="ghost" size="icon-sm" onClick={() => zoomTo(viewport.zoom * 1.25)} aria-label="Zoom in">
          <Plus />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Fit everything">
          <Maximize />
        </Button>
      </div>
      {mode === "comment" && <p className="pointer-events-none absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[13px] text-background">Click anywhere, or on a frame, to comment · Esc to stop</p>}
    </div>
  );
}

function ToolButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="icon-sm" onClick={onClick} aria-label={label} aria-pressed={active} title={label}>
      {children}
    </Button>
  );
}
