"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importLibraryItemAction, searchOpenLibraryAction } from "@/server/actions/library";
import type { OpenLibraryCard } from "@/server/services/open-library";
import { cn } from "@/lib/utils";

type Kind = OpenLibraryCard["kind"];

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "texture", label: "Textures", hint: "Surfaces for backgrounds, grain and material." },
  { id: "hdri", label: "Skies & HDRIs", hint: "Wide environments, skies and light for backdrops." },
];

const SOURCE_LABEL: Record<string, string> = { polyhaven: "Poly Haven", "noto-emoji": "Noto Emoji" };

/**
 * Browses the harvested open library. Search runs against our own catalog,
 * so it's instant and free; files are copied into the workspace only when added.
 */
export function OpenLibrary({
  slug,
  kind,
  initial,
  categories,
  projects,
  defaultProjectId,
  canEdit,
  canSync,
}: {
  slug: string;
  kind: Kind;
  initial: { items: OpenLibraryCard[]; hasMore: boolean };
  categories: { category: string; n: number }[];
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  canEdit: boolean;
  canSync: boolean;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState(initial.items);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "none");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await searchOpenLibraryAction(slug, { q, kind, category: category ?? undefined });
        if (!res.ok) return void toast.error(res.message);
        setItems(res.data.items);
        setHasMore(res.data.hasMore);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q, category, kind, slug]);

  const more = () =>
    startSearch(async () => {
      const res = await searchOpenLibraryAction(slug, { q, kind, category: category ?? undefined, offset: items.length });
      if (!res.ok) return void toast.error(res.message);
      setItems((prev) => [...prev, ...res.data.items]);
      setHasMore(res.data.hasMore);
    });

  const add = async (item: OpenLibraryCard) => {
    setBusy(item.id);
    const target = projectId === "none" ? undefined : projectId;
    const res = await importLibraryItemAction(slug, item.id, target);
    setBusy(null);
    if (!res.ok) return void toast.error(res.message);
    setAdded((s) => new Set(s).add(item.id));
    const where = target ? `“${projects.find((p) => p.id === target)?.name}”` : "My assets";
    toast.success(res.data.created ? `Added to ${where}` : `Already in ${where}`, item.attributionRequired ? { description: `Credit required: ${item.credit}` } : undefined);
  };

  const meta = KINDS.find((k) => k.id === kind)!;
  const empty = initial.items.length === 0 && !q && !category;

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1.5" aria-label="Open library type">
        {KINDS.map((k) => (
          <Link
            key={k.id}
            href={`/w/${slug}/library?tab=assets&view=materials&kind=${k.id}${defaultProjectId ? `&project=${defaultProjectId}` : ""}`}
            aria-current={k.id === kind ? "page" : undefined}
            className={cn("rounded-full border px-3.5 py-1.5 text-[15px] transition-colors hover:bg-hover", k.id === kind && "border-foreground bg-foreground text-background hover:bg-foreground")}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      {empty ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Nothing synced yet</p>
          <p className="mx-auto mt-1 max-w-[52ch] text-[15px] text-muted-foreground">
            The open library fills from free, openly licensed sources: Poly Haven (CC0 textures and HDRIs) and Google&apos;s Animated Noto Emoji (CC BY 4.0).
          </p>
          {canSync ? (
            <Button asChild className="mt-4">
              <Link href={`/w/${slug}/settings/sources#open-library`}>Sync sources</Link>
            </Button>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Ask a workspace admin to sync the sources in Settings → Sources.</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor="open-q" className="sr-only">
                Search {meta.label.toLowerCase()}
              </label>
              <Input id="open-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "lottie" ? "Search: rocket, heart, party, fire…" : "Search: concrete, wood, sunset, studio…"} className="h-10 pl-9" />
              {searching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}
            </div>
            {canEdit && (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-10 w-[220px]" aria-label="Add to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Add to My assets</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Add to {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categories">
              {categories.slice(0, 16).map((c) => (
                <button
                  key={c.category}
                  onClick={() => setCategory(category === c.category ? null : c.category)}
                  aria-pressed={category === c.category}
                  className={cn("rounded-md bg-muted px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground", category === c.category && "bg-foreground text-background hover:text-background")}
                >
                  {c.category} <span className="tabular opacity-70">{c.n}</span>
                </button>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-muted-foreground">No matches. Try a broader word.</p>
          ) : (
            <ul className={cn("grid gap-3", kind === "lottie" ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5")}>
              {items.map((item) => (
                <li key={item.id}>
                  <Card item={item} canEdit={canEdit} busy={busy === item.id} added={added.has(item.id)} onAdd={() => add(item)} />
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={more} disabled={searching}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}

      <footer className="border-t pt-4 text-sm text-muted-foreground">
        {kind === "lottie" ? (
          <>
            Animations: <a className="underline underline-offset-4" href="https://googlefonts.github.io/noto-emoji-animation/" target="_blank" rel="noreferrer">Animated Noto Emoji</a> by Google,{" "}
            <a className="underline underline-offset-4" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Credit is required; it travels with each animation into your project.
          </>
        ) : (
          <>
            Textures and HDRIs from{" "}
            <a className="underline underline-offset-4" href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a>, released under{" "}
            <a className="underline underline-offset-4" href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a>. Free for commercial use; no credit needed in your work.
          </>
        )}
      </footer>
    </div>
  );
}

function Card({ item, canEdit, busy, added, onAdd }: { item: OpenLibraryCard; canEdit: boolean; busy: boolean; added: boolean; onAdd: () => void }) {
  const [live, setLive] = useState(false);
  const lottie = item.kind === "lottie";
  const src = live && item.previewUrl ? item.previewUrl : item.thumbnailUrl;
  return (
    <div
      className="group relative overflow-hidden rounded-lg bg-card shadow-card"
      onMouseEnter={() => setLive(true)}
      onMouseLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setLive(false)}
    >
      <div className={cn("flex items-center justify-center bg-muted", lottie ? "aspect-square p-3" : "aspect-[4/3]")}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className={cn("size-full motion-reduce:hidden", lottie ? "object-contain" : "object-cover")} />
        )}
        {item.thumbnailUrl && (
          // Reduced motion: always the still thumbnail.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt="" loading="lazy" className={cn("hidden size-full motion-reduce:block", lottie ? "object-contain" : "object-cover")} />
        )}
      </div>
      <div className="space-y-1 px-2.5 py-2">
        <p className="truncate text-sm font-medium" title={item.name}>
          {item.name}
        </p>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="truncate underline-offset-4 hover:underline">
            {SOURCE_LABEL[item.source] ?? item.source}
          </a>
          <span aria-hidden>·</span>
          <span className="shrink-0">{item.license}</span>
        </p>
      </div>
      {canEdit && (
        <Button
          size="icon-sm"
          variant={added ? "secondary" : "default"}
          onClick={onAdd}
          disabled={busy}
          aria-label={added ? `${item.name} added` : `Add ${item.name}`}
          className="absolute top-2 right-2 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {busy ? <Loader2 className="animate-spin" /> : added ? <Check /> : <Plus />}
        </Button>
      )}
    </div>
  );
}
