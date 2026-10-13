"use client";

import type { PlayerRef } from "@remotion/player";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Library, Map as MapIcon, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveBoardAction } from "@/server/actions/board";
import { saveSpecAction, startBlankSpecAction } from "@/server/actions/journey";
import { importLibraryItemAction } from "@/server/actions/library";
import { getPreset } from "@/lib/animations/presets";
import { DEFAULT_SIZE, newItemId, type BoardDoc, type BoardItem } from "@/lib/board";
import { placeOnScene, type Placeable } from "@/lib/creative-spec/ops";
import { sceneOffsets, type CreativeSpecDoc } from "@/lib/creative-spec/schema";
import type { DragItem } from "@/lib/drag";
import { cn } from "@/lib/utils";
import { BoardCanvas } from "./canvas";
import { LibraryDrawer, type DrawerAsset, type DrawerReference } from "./library-drawer";
import { SidePanel } from "./side-panel";
import { SceneStack } from "./stack";

type Saved = "saved" | "saving" | "error";

/**
 * A Riffle-shaped workspace for one project: library on the left, a free
 * board in the middle, the stack of scenes below, preview and Sous chef on the
 * right. Everything here is deterministic and instant; AI lives in Brain and
 * the journey's draft steps.
 */
export function BoardStudio({
  slug,
  project,
  initialBoard,
  initialSpec,
  assets: initialAssets,
  references,
  canEdit,
  aiEnabled,
}: {
  slug: string;
  project: { id: string; name: string; color: string };
  initialBoard: BoardDoc;
  initialSpec: CreativeSpecDoc | null;
  assets: DrawerAsset[];
  references: DrawerReference[];
  canEdit: boolean;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [spec, setSpec] = useState(initialSpec);
  const [assets, setAssets] = useState(initialAssets);
  const [selected, setSelected] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(initialSpec?.scenes[0]?.id ?? null);
  const [hoverScene, setHoverScene] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(true);
  const [panel, setPanel] = useState(true);
  const [boardSaved, setBoardSaved] = useState<Saved>("saved");
  const [specSaved, setSpecSaved] = useState<Saved>("saved");
  const [starting, startTransition] = useTransition();
  const player = useRef<PlayerRef>(null);
  const boardDirty = useRef(false);
  const specDirty = useRef(false);
  const base = `/w/${slug}/projects/${project.id}`;

  // On small screens the panels overlay the board, so they start closed and only one opens at a time.
  const [small, setSmall] = useState(false);
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

  // A fresh spec from the server (e.g. after "Start the stack") replaces ours.
  useEffect(() => {
    if (!specDirty.current) setSpec(initialSpec);
    if (initialSpec && !scene) setScene(initialSpec.scenes[0]?.id ?? null);
  }, [initialSpec, scene]);

  useEffect(() => {
    if (!boardDirty.current || !canEdit) return;
    setBoardSaved("saving");
    const t = setTimeout(async () => {
      const res = await saveBoardAction(slug, project.id, board);
      setBoardSaved(res.ok ? "saved" : "error");
      if (!res.ok) toast.error(res.message);
    }, 800);
    return () => clearTimeout(t);
  }, [board, slug, project.id, canEdit]);

  useEffect(() => {
    if (!specDirty.current || !canEdit || !spec) return;
    setSpecSaved("saving");
    const t = setTimeout(async () => {
      const res = await saveSpecAction(slug, project.id, spec);
      setSpecSaved(res.ok ? "saved" : "error");
      if (!res.ok) toast.error(res.message);
    }, 700);
    return () => clearTimeout(t);
  }, [spec, slug, project.id, canEdit]);

  const editBoard = useCallback((fn: (b: BoardDoc) => BoardDoc) => {
    boardDirty.current = true;
    setBoard(fn);
  }, []);
  const editSpec = useCallback((next: CreativeSpecDoc) => {
    specDirty.current = true;
    setSpec(next);
  }, []);

  const onViewport = useCallback((viewport: BoardDoc["viewport"]) => editBoard((b) => ({ ...b, viewport })), [editBoard]);
  const onItem = useCallback((id: string, patch: Partial<BoardItem>) => editBoard((b) => ({ ...b, items: b.items.map((i) => (i.id === id ? ({ ...i, ...patch } as BoardItem) : i)) })), [editBoard]);
  const onRemove = useCallback(
    (id: string) => {
      editBoard((b) => ({ ...b, items: b.items.filter((i) => i.id !== id) }));
      setSelected(null);
    },
    [editBoard],
  );
  const addItem = (item: BoardItem) => {
    editBoard((b) => ({ ...b, items: [...b.items, item] }));
    setSelected(item.id);
  };

  const selectScene = (id: string) => {
    setScene(id);
    const o = spec ? sceneOffsets(spec).find((x) => x.id === id) : null;
    if (o) player.current?.seekTo(o.from + Math.min(o.frames - 1, 15));
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

  const toBoardItem = (p: DragItem, at: { x: number; y: number }): BoardItem | null => {
    const place = (kind: BoardItem["kind"]) => ({ id: newItemId(), x: Math.round(at.x - DEFAULT_SIZE[kind].w / 2), y: Math.round(at.y - DEFAULT_SIZE[kind].h / 2), ...DEFAULT_SIZE[kind] });
    switch (p.type) {
      case "asset":
        if (!p.url) return null;
        return p.kind === "animation"
          ? { ...place("lottie"), kind: "lottie", assetId: p.id, url: p.url, thumbnailUrl: p.thumbnailUrl ?? null, name: p.name, credit: p.credit ?? null }
          : { ...place("image"), kind: "image", assetId: p.id, url: p.url, name: p.name, credit: p.credit ?? null };
      case "animation":
        return { ...place("preset"), kind: "preset", presetId: p.presetId, params: p.params as Record<string, number | string | boolean>, name: p.name };
      case "reference":
        return { ...place("reference"), kind: "reference", referenceId: p.id, title: p.title, imageUrl: p.imageUrl, url: p.url ?? null };
      default:
        return null;
    }
  };

  const dropOnBoard = async (payload: DragItem, at: { x: number; y: number }) => {
    const resolved = await resolve(payload);
    const item = resolved && toBoardItem(resolved, at);
    if (item) addItem(item);
  };

  const addFromDrawer = (payload: DragItem) => {
    const v = board.viewport;
    const jitter = () => Math.round(Math.random() * 80 - 40);
    void dropOnBoard(payload, { x: (-v.x + 420) / v.zoom + jitter(), y: (-v.y + 260) / v.zoom + jitter() });
  };

  const placeable = (p: DragItem | BoardItem): Placeable | null => {
    if ("type" in p) {
      if (p.type === "asset") return p.url ? { kind: p.kind === "animation" ? "lottie" : "image", assetId: p.id, url: p.url, credit: p.credit } : null;
      if (p.type === "animation") return { kind: "preset", presetId: p.presetId, category: getPreset(p.presetId)?.category ?? "", params: p.params as Record<string, number | string | boolean> };
      if (p.type === "reference") return { kind: "reference" };
      return null;
    }
    switch (p.kind) {
      case "image":
      case "lottie":
        return { kind: p.kind, assetId: p.assetId, url: p.url, credit: p.credit };
      case "preset":
        return { kind: "preset", presetId: p.presetId, category: getPreset(p.presetId)?.category ?? "", params: p.params };
      case "note":
        return { kind: "note", text: p.text };
      case "palette":
        return { kind: "palette", colors: p.colors };
      case "reference":
        return { kind: "reference" };
    }
  };

  const placeInScene = (item: Placeable | null, sceneId: string) => {
    if (!spec || !item) return;
    const res = placeOnScene(spec, sceneId, item);
    if (!res.ok) return void toast.error(res.message);
    editSpec(res.spec);
    selectScene(sceneId);
    toast.success(res.message);
  };

  const dropOnScene = async (payload: DragItem, sceneId: string) => {
    const resolved = await resolve(payload);
    if (resolved) placeInScene(placeable(resolved), sceneId);
  };

  const onAdd = (kind: "note" | "palette", at: { x: number; y: number }) => {
    const size = DEFAULT_SIZE[kind];
    const pos = { id: newItemId(), x: Math.round(at.x - size.w / 2), y: Math.round(at.y - size.h / 2), ...size };
    addItem(
      kind === "note"
        ? { ...pos, kind: "note", text: "", color: "yellow" }
        : { ...pos, kind: "palette", name: "Palette", colors: spec ? [spec.style.background, spec.style.foreground, spec.style.accent].map((c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#888888")) : ["#141210", "#f3efe7", "#d9732b"] },
    );
  };

  const startStack = () =>
    startTransition(async () => {
      const res = await startBlankSpecAction(slug, project.id);
      if (!res.ok) return void toast.error(res.message);
      router.refresh();
    });

  // Warn before leaving while a save is still on its way.
  const pendingSave = boardSaved === "saving" || specSaved === "saving";
  useEffect(() => {
    if (!pendingSave) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingSave]);

  const saved: Saved = boardSaved === "error" || specSaved === "error" ? "error" : boardSaved === "saving" || specSaved === "saving" ? "saving" : "saved";

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
        {canEdit && (
          <span className="hidden text-[13px] text-muted-foreground sm:inline" aria-live="polite">
            {saved === "saving" ? "Saving…" : saved === "error" ? "Not saved" : "Saved"}
          </span>
        )}
        <Button variant={drawer ? "secondary" : "ghost"} size="sm" className="max-sm:px-2" onClick={toggleDrawer} aria-pressed={drawer}>
          <Library data-icon="inline-start" /> Library
        </Button>
        <Button variant={panel ? "secondary" : "ghost"} size="sm" onClick={togglePanel} aria-pressed={panel}>
          <PanelRight data-icon="inline-start" /> Preview
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {small && (drawer || panel) && (
          <button
            aria-label="Close panel"
            className="absolute inset-0 z-10 bg-black/20"
            onClick={() => {
              setDrawer(false);
              setPanel(false);
            }}
          />
        )}
        <div className={cn("z-20 h-full w-[300px] max-w-[85vw] shrink-0 border-r max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-xl", !drawer && "hidden")}>
          <LibraryDrawer slug={slug} assets={assets} references={references} onAdd={addFromDrawer} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <BoardCanvas
            board={board}
            canEdit={canEdit}
            selected={selected}
            onSelect={setSelected}
            onViewport={onViewport}
            onItem={onItem}
            onRemove={onRemove}
            onAdd={onAdd}
            onDropPayload={(p, at) => void dropOnBoard(p, at)}
            onCardToScene={(item, sceneId) => placeInScene(placeable(item), sceneId)}
            onHoverScene={setHoverScene}
          />
          <div className="h-[210px] shrink-0">
            <SceneStack
              spec={spec}
              selectedScene={scene}
              hoverScene={hoverScene}
              canEdit={canEdit}
              starting={starting}
              onStart={startStack}
              onSelect={selectScene}
              onEdit={editSpec}
              onDropPayload={(p, sceneId) => void dropOnScene(p, sceneId)}
            />
          </div>
        </div>

        <div className={cn("z-20 h-full w-[320px] max-w-[85vw] shrink-0 border-l max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-xl", !panel && "hidden")}>
          <SidePanel ref={player} spec={spec} canEdit={canEdit} designHref={`${base}?view=guide&stage=design`} brainHref={aiEnabled ? `/w/${slug}/brain` : null} onEdit={editSpec} />
        </div>
      </div>
    </div>
  );
}
