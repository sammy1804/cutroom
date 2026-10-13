"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Library, Map as MapIcon, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importLibraryItemAction } from "@/server/actions/library";
import type { CommentView } from "@/server/services/board";
import { getPreset } from "@/lib/animations/presets";
import { LOOSE_SIZE, newId, type BoardDoc, type Viewport } from "@/lib/board";
import { frameFromDrop, placeOnFrame } from "@/lib/board-place";
import type { Placeable } from "@/lib/creative-spec/ops";
import type { DragItem } from "@/lib/drag";
import { cn } from "@/lib/utils";
import { BoardCanvas, type Mode } from "./canvas";
import { threadPoint, threadsOf, type Thread } from "./comments";
import { LibraryDrawer, type DrawerAsset, type DrawerReference } from "./library-drawer";
import { SidePanel } from "./side-panel";
import { useBoardSync } from "./use-board-sync";

/**
 * The project board (docs/BOARD.md): library on the left, frames you edit in
 * place and connect into the video in the middle, the video and comments on
 * the right. Edits sync live to everyone on the board.
 */
export function BoardStudio({
  slug,
  project,
  me,
  initialBoard,
  initialVersion,
  initialComments,
  assets: initialAssets,
  references,
  canEdit,
  canModerate,
  aiEnabled,
}: {
  slug: string;
  project: { id: string; name: string; color: string };
  me: { id: string; name: string };
  initialBoard: BoardDoc;
  initialVersion: number;
  initialComments: CommentView[];
  assets: DrawerAsset[];
  references: DrawerReference[];
  canEdit: boolean;
  canModerate: boolean;
  aiEnabled: boolean;
}) {
  const sync = useBoardSync({ slug, projectId: project.id, initial: initialBoard, initialVersion, initialComments, canEdit });
  const { board, commit, setSelection } = sync;
  const [assets, setAssets] = useState(initialAssets);
  const [selected, setSelectedState] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [tab, setTab] = useState<"video" | "comments">("video");
  const [drawer, setDrawer] = useState(true);
  const [panel, setPanel] = useState(true);
  const [small, setSmall] = useState(false);
  const base = `/w/${slug}/projects/${project.id}`;
  const threads = useMemo(() => threadsOf(sync.comments), [sync.comments]);

  // Each person keeps their own view of the board.
  const vpKey = `board-vp:${project.id}`;
  const [viewport, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(vpKey) ?? "null") as Viewport | null;
      if (saved && typeof saved.zoom === "number") setViewportState(saved);
    } catch {}
  }, [vpKey]);
  const setViewport = useCallback(
    (v: Viewport) => {
      setViewportState(v);
      try {
        localStorage.setItem(vpKey, JSON.stringify(v));
      } catch {}
    },
    [vpKey],
  );

  const setSelected = useCallback(
    (id: string | null) => {
      setSelectedState(id);
      setSelection(id);
    },
    [setSelection],
  );

  // On small screens the panels overlay the board, start closed, and open one at a time.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      setSmall(mq.matches);
      if (mq.matches) {
        setDrawer(false);
        setPanel(false);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const toggleDrawer = () => {
    setDrawer((d) => !d);
    if (small) setPanel(false);
  };
  const togglePanel = () => {
    setPanel((p) => !p);
    if (small) setDrawer(false);
  };

  /** Library items are copied into the project (with their rights) the first time they're used. */
  const resolve = async (payload: DragItem): Promise<DragItem | null> => {
    if (payload.type !== "library") return payload;
    const pending = toast.loading(`Adding ${payload.name}…`);
    const res = await importLibraryItemAction(slug, payload.id, project.id);
    toast.dismiss(pending);
    if (!res.ok) {
      toast.error(res.message);
      return null;
    }
    const a = res.data;
    const asset: DrawerAsset = { id: a.assetId, kind: a.kind === "animation" ? "animation" : "image", name: a.name, url: a.url, thumbnailUrl: a.thumbnailUrl, credit: a.credit };
    setAssets((list) => (list.some((x) => x.id === asset.id) ? list : [asset, ...list]));
    return { type: "asset", id: asset.id, kind: asset.kind, url: asset.url, name: asset.name, thumbnailUrl: asset.thumbnailUrl, credit: asset.credit };
  };

  const placeable = (p: DragItem): Placeable | null => {
    if (p.type === "asset") return p.url ? { kind: p.kind === "animation" ? "lottie" : "image", assetId: p.id, url: p.url, credit: p.credit } : null;
    if (p.type === "animation") return { kind: "preset", presetId: p.presetId, category: getPreset(p.presetId)?.category ?? "", params: p.params as Record<string, number | string | boolean> };
    if (p.type === "reference") return { kind: "reference" };
    return null;
  };

  const onDropPayload = async (payload: DragItem, at: { x: number; y: number }, frameId: string | null) => {
    if (payload.type === "reference" && !frameId) {
      const s = LOOSE_SIZE.reference;
      commit([{ t: "item", item: { id: newId("i"), kind: "reference", x: Math.round(at.x - s.w / 2), y: Math.round(at.y - s.h / 2), ...s, referenceId: payload.id, title: payload.title, imageUrl: payload.imageUrl, url: payload.url ?? null } }]);
      return;
    }
    const resolved = await resolve(payload);
    const item = resolved && placeable(resolved);
    if (!item) return;
    if (frameId) {
      const res = placeOnFrame(board, frameId, item);
      if (!res.ok) return void toast.error(res.message);
      commit(res.ops);
      setSelected(frameId);
      toast.success(res.message);
      return;
    }
    const frame = frameFromDrop(board, item, at);
    if (!frame) {
      toast.message(item.kind === "preset" && item.category === "transition" ? "Transitions go on the arrow between two frames." : "Drop this onto a frame to use it.");
      return;
    }
    commit([{ t: "frame", frame }]);
    setSelected(frame.id);
  };

  /** The + on a library tile: adds to the selected frame, or makes a new frame in view. */
  const addFromDrawer = (payload: DragItem) => {
    const frameId = selected && board.frames.some((f) => f.id === selected) ? selected : null;
    const at = { x: (-viewport.x + 480) / viewport.zoom, y: (-viewport.y + 300) / viewport.zoom };
    void onDropPayload(payload, at, frameId);
  };

  const jumpTo = (t: Thread) => {
    const p = threadPoint(board, t.root);
    const el = document.querySelector('[role="application"]') as HTMLElement | null;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    setViewport({ zoom: viewport.zoom, x: w / 2 - p.x * viewport.zoom, y: h / 2 - p.y * viewport.zoom });
    setOpenThread(t.root.id);
    if (small) setPanel(false);
  };

  const people = [{ key: "me", name: `${me.name} (you)`, color: "var(--foreground)" }, ...sync.peers.map((p) => ({ key: p.clientId, name: p.name, color: p.color }))];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/w/${slug}/projects`} aria-label="Back to projects">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="size-3 shrink-0 rounded-sm" style={{ background: project.color }} aria-hidden />
        <h1 className="min-w-0 truncate text-[15px] font-semibold">{project.name}</h1>
        <nav className="ml-2 hidden items-center rounded-lg bg-muted p-0.5 text-[13px] sm:flex" aria-label="Project view">
          <span aria-current="page" className="rounded-md bg-background px-2.5 py-1 font-medium shadow-sm">
            Board
          </span>
          <Link href={`${base}?view=guide`} className="rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground">
            <MapIcon className="mr-1 inline size-3.5" aria-hidden />
            Guide
          </Link>
        </nav>
        <span className="flex-1" />
        <ul className="hidden items-center -space-x-1.5 sm:flex" aria-label={`${people.length} on this board`}>
          {people.slice(0, 5).map((p) => (
            <li key={p.key} title={p.name} className="flex size-7 items-center justify-center rounded-full border-2 border-background text-[12px] font-semibold" style={{ background: p.color, color: p.key === "me" ? "var(--background)" : "#fff" }}>
              {p.name.charAt(0).toUpperCase()}
            </li>
          ))}
        </ul>
        <span className={cn("hidden items-center gap-1.5 text-[13px] text-muted-foreground md:flex", sync.status === "offline" && "text-destructive")} aria-live="polite">
          <span className={cn("size-2 rounded-full", sync.status === "offline" ? "bg-destructive" : sync.saving ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
          {sync.status === "offline" ? "Offline, retrying" : sync.saving ? "Saving…" : sync.peers.length ? "Live" : "Saved"}
        </span>
        <Button variant={drawer ? "secondary" : "ghost"} size="sm" className="max-sm:px-2" onClick={toggleDrawer} aria-pressed={drawer}>
          <Library data-icon="inline-start" /> <span className="max-sm:sr-only">Library</span>
        </Button>
        <Button variant={panel ? "secondary" : "ghost"} size="sm" className="max-sm:px-2" onClick={togglePanel} aria-pressed={panel}>
          <PanelRight data-icon="inline-start" /> <span className="max-sm:sr-only">Video</span>
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {small && (drawer || panel) && (
          <button
            aria-label="Close panel"
            className="absolute inset-0 z-40 bg-black/20"
            onClick={() => {
              setDrawer(false);
              setPanel(false);
            }}
          />
        )}
        <div className={cn("z-50 h-full w-[300px] max-w-[85vw] shrink-0 border-r max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-xl", !drawer && "hidden")}>
          <LibraryDrawer slug={slug} assets={assets} references={references} onAdd={addFromDrawer} />
        </div>

        <BoardCanvas
          slug={slug}
          projectId={project.id}
          board={board}
          commit={commit}
          canEdit={canEdit}
          viewport={viewport}
          setViewport={setViewport}
          selected={selected}
          setSelected={setSelected}
          mode={mode}
          setMode={setMode}
          peers={sync.peers}
          threads={threads}
          openThread={openThread}
          setOpenThread={setOpenThread}
          me={me.id}
          canModerate={canModerate}
          assets={assets}
          setCursor={sync.setCursor}
          onDropPayload={(p, at, f) => void onDropPayload(p, at, f)}
          onCommentSaved={sync.upsertComment}
          onCommentDeleted={sync.dropComment}
        />

        <div className={cn("z-50 h-full w-[320px] max-w-[85vw] shrink-0 border-l max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-xl", !panel && "hidden")}>
          <SidePanel
            board={board}
            canEdit={canEdit}
            commit={commit}
            threads={threads}
            tab={tab}
            setTab={setTab}
            finalHref={`${base}?view=guide&stage=final`}
            brainHref={aiEnabled ? `/w/${slug}/brain` : null}
            onJump={jumpTo}
          />
        </div>
      </div>
    </div>
  );
}
