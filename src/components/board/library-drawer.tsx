"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { AnimationPreview } from "@/components/library/animation-preview";
import { searchOpenLibraryAction } from "@/server/actions/library";
import type { OpenLibraryCard } from "@/server/services/open-library";
import { ANIMATION_PRESETS, CATEGORY_LABEL } from "@/lib/animations/presets";
import { setDragItem, type DragItem } from "@/lib/drag";
import { cn } from "@/lib/utils";

export interface DrawerAsset {
  id: string;
  kind: "image" | "animation";
  name: string;
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
}
export interface DrawerReference {
  id: string;
  title: string;
  imageUrl: string | null;
  url: string | null;
}

const TABS = [
  { id: "motion", label: "Motion" },
  { id: "lottie", label: "Animations" },
  { id: "texture", label: "Textures" },
  { id: "assets", label: "Assets" },
  { id: "refs", label: "Refs" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Only presets that can land in a scene are offered on the board. */
const PLACEABLE = ["text", "image", "background", "transition"] as const;

/**
 * The library panel on the left of the board, like Riffle's sample library:
 * everything is searchable instantly and draggable onto the board or straight
 * onto a scene. Enter (or the + button) adds an item to the middle of the board.
 */
export function LibraryDrawer({
  slug,
  assets,
  references,
  onAdd,
}: {
  slug: string;
  assets: DrawerAsset[];
  references: DrawerReference[];
  onAdd: (item: DragItem) => void;
}) {
  const [tab, setTab] = useState<Tab>("motion");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof PLACEABLE)[number] | "all">("all");
  const [open, setOpen] = useState<OpenLibraryCard[]>([]);
  const [loading, start] = useTransition();

  // Results are tagged with their kind so a slow response can't fill the wrong tab.
  const [openKind, setOpenKind] = useState<string | null>(null);
  useEffect(() => {
    if (tab !== "lottie" && tab !== "texture") return;
    let live = true;
    const t = setTimeout(
      () =>
        start(async () => {
          const res = await searchOpenLibraryAction(slug, { q, kind: tab });
          if (!live) return;
          if (!res.ok) return void toast.error(res.message);
          setOpen(res.data.items);
          setOpenKind(tab);
        }),
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [tab, q, slug]);
  const openItems = openKind === tab ? open : [];

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const match = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const presets = useMemo(
    () =>
      ANIMATION_PRESETS.filter((p) => (PLACEABLE as readonly string[]).includes(p.category))
        .filter((p) => cat === "all" || p.category === cat)
        .filter((p) => match(`${p.name} ${p.category} ${p.moods.join(" ")} ${p.description}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, cat],
  );

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar" aria-label="Library">
      <div className="space-y-2 border-b p-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Library section">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn("rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-hover hover:text-foreground", tab === t.id && "bg-foreground text-background hover:bg-foreground hover:text-background")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="drawer-q" className="sr-only">
            Search the library
          </label>
          <Input id="drawer-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 bg-background pl-8" />
          {loading && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}
        </div>
        {tab === "motion" && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Motion type">
            {(["all", ...PLACEABLE] as const).map((c) => (
              <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn("rounded px-1.5 py-0.5 text-[12px] text-muted-foreground hover:text-foreground", cat === c && "bg-muted font-medium text-foreground")}>
                {c === "all" ? "All" : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "motion" && (
          <ul className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <Tile key={p.id} label={p.name} sub={CATEGORY_LABEL[p.category]} item={{ type: "animation", presetId: p.id, params: {}, name: p.name }} onAdd={onAdd}>
                <AnimationPreview layers={[{ presetId: p.id }]} className="rounded-md" />
              </Tile>
            ))}
          </ul>
        )}

        {(tab === "lottie" || tab === "texture") && (
          <>
            <ul className={cn("grid gap-2", tab === "lottie" ? "grid-cols-3" : "grid-cols-2")}>
              {openItems.map((i) => (
                <Tile key={i.id} label={i.name} sub={i.license} item={{ type: "library", id: i.id, kind: i.kind, name: i.name, thumbnailUrl: i.thumbnailUrl, credit: i.attributionRequired ? i.credit : null }} onAdd={onAdd}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.thumbnailUrl ?? ""} alt="" loading="lazy" draggable={false} className={cn("w-full rounded-md bg-muted", tab === "lottie" ? "aspect-square object-contain p-1.5" : "aspect-square object-cover")} />
                </Tile>
              ))}
            </ul>
            {!loading && openKind === tab && openItems.length === 0 && <Empty text={q ? "No matches." : "Nothing synced yet. An admin can sync it in Settings → Sources."} />}
            <p className="mt-3 text-[12px] text-muted-foreground">{tab === "lottie" ? "Animated Noto Emoji by Google, CC BY 4.0." : "Textures from Poly Haven, CC0."}</p>
          </>
        )}

        {tab === "assets" &&
          (assets.filter((a) => match(a.name)).length ? (
            <ul className="grid grid-cols-2 gap-2">
              {assets
                .filter((a) => match(a.name))
                .map((a) => (
                  <Tile key={a.id} label={a.name} sub={a.kind === "animation" ? "Animation" : "Image"} item={{ type: "asset", id: a.id, kind: a.kind, url: a.url, name: a.name, thumbnailUrl: a.thumbnailUrl, credit: a.credit }} onAdd={onAdd}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumbnailUrl ?? a.url} alt="" loading="lazy" draggable={false} className={cn("aspect-square w-full rounded-md bg-muted", a.kind === "animation" ? "object-contain p-2" : "object-cover")} />
                  </Tile>
                ))}
            </ul>
          ) : (
            <Empty text="No approved assets in this project yet. Add some from Animations, Textures or Library → Free assets." />
          ))}

        {tab === "refs" &&
          (references.filter((r) => match(r.title)).length ? (
            <ul className="space-y-2">
              {references
                .filter((r) => match(r.title))
                .map((r) => (
                  <Tile key={r.id} label={r.title} sub="Reference only" item={{ type: "reference", id: r.id, title: r.title, imageUrl: r.imageUrl, url: r.url }} onAdd={onAdd}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" draggable={false} className="aspect-video w-full rounded-md bg-muted object-cover object-top" /> : <div className="aspect-video rounded-md bg-muted" />}
                  </Tile>
                ))}
            </ul>
          ) : (
            <Empty text="No references yet. Capture pages in the Explore stage." />
          ))}
      </div>
    </aside>
  );
}

function Tile({ label, sub, item, onAdd, children }: { label: string; sub: string; item: DragItem; onAdd: (item: DragItem) => void; children: React.ReactNode }) {
  return (
    <li
      draggable
      onDragStart={(e) => setDragItem(e, item)}
      className="group relative cursor-grab rounded-lg p-1 hover:bg-hover active:cursor-grabbing"
      title={`${label}: drag onto the board or a scene`}
    >
      {children}
      <p className="mt-1 truncate px-0.5 text-[12px] font-medium">{label}</p>
      <p className="truncate px-0.5 text-[11px] text-muted-foreground">{sub}</p>
      <button
        onClick={() => onAdd(item)}
        aria-label={`Add ${label} to the board`}
        className="absolute top-2 right-2 rounded-md bg-background/90 p-1 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Plus className="size-3.5" />
      </button>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
