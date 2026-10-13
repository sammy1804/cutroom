"use client";

import { ExternalLink, GripHorizontal, Palette, Quote, StickyNote, X } from "lucide-react";
import { NOTE_COLORS, type LooseItem } from "@/lib/board";
import { cn } from "@/lib/utils";

const ICON = { note: StickyNote, reference: Quote, palette: Palette } as const;

export function itemLabel(item: LooseItem) {
  switch (item.kind) {
    case "note":
      return item.text.split("\n")[0]?.slice(0, 40) || "Note";
    case "reference":
      return item.title;
    case "palette":
      return item.name;
  }
}

/**
 * One card on the board. The header strip is the drag handle; the body stays
 * interactive (notes are typed into directly, palette swatches open a picker).
 */
export function BoardCard({
  item,
  selected,
  canEdit,
  dragging,
  onHandlePointerDown,
  onResizePointerDown,
  onSelect,
  onChange,
  onRemove,
}: {
  item: LooseItem;
  selected: boolean;
  canEdit: boolean;
  dragging: boolean;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onChange: (patch: Partial<LooseItem>) => void;
  onRemove: () => void;
}) {
  const Icon = ICON[item.kind];
  const note = item.kind === "note" ? (NOTE_COLORS[item.color] ?? NOTE_COLORS.yellow!) : null;
  return (
    <div
      role="group"
      aria-label={`${item.kind}: ${itemLabel(item)}`}
      data-board-card={item.id}
      data-board-node
      onPointerDown={onSelect}
      className={cn(
        "group absolute flex flex-col overflow-hidden rounded-lg bg-card shadow-card ring-1 ring-black/5 transition-shadow",
        selected && "ring-2 ring-tally",
        dragging && "opacity-80 shadow-xl",
      )}
      style={{ left: item.x, top: item.y, width: item.w, height: item.h, background: note?.bg }}
    >
      <div
        onPointerDown={canEdit ? onHandlePointerDown : undefined}
        tabIndex={0}
        aria-label={`Move ${itemLabel(item)}. Arrow keys nudge, Delete removes.`}
        className={cn("flex h-7 shrink-0 items-center gap-1.5 px-2 text-[12px] text-muted-foreground outline-none select-none focus-visible:bg-hover", canEdit && "cursor-grab active:cursor-grabbing")}
        style={note ? { color: note.fg, opacity: 0.7 } : undefined}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.kind === "note" ? "Note" : itemLabel(item)}</span>
        <GripHorizontal className="size-3.5 shrink-0 opacity-0 group-hover:opacity-60" aria-hidden />
        {canEdit && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            aria-label={`Remove ${itemLabel(item)} from the board`}
            className="rounded p-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-black/10 focus-visible:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <Body item={item} canEdit={canEdit} onChange={onChange} />
      </div>
      {canEdit && (
        <div
          onPointerDown={onResizePointerDown}
          aria-hidden
          className="absolute right-0 bottom-0 size-4 cursor-nwse-resize opacity-0 group-hover:opacity-100"
          style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,.25) 50%)" }}
        />
      )}
    </div>
  );
}

function Body({ item, canEdit, onChange }: { item: LooseItem; canEdit: boolean; onChange: (patch: Partial<LooseItem>) => void }) {
  switch (item.kind) {
    case "note": {
      const c = NOTE_COLORS[item.color] ?? NOTE_COLORS.yellow!;
      return (
        <div className="flex h-full flex-col">
          <label htmlFor={`note-${item.id}`} className="sr-only">
            Note text
          </label>
          <textarea
            id={`note-${item.id}`}
            value={item.text}
            readOnly={!canEdit}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Write an idea, a line, a feeling…"
            className="min-h-0 flex-1 resize-none bg-transparent px-3 pb-1 text-[15px] leading-snug outline-none placeholder:opacity-50"
            style={{ color: c.fg }}
          />
          {canEdit && (
            <div className="flex gap-1 px-2.5 pb-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" role="group" aria-label="Note colour">
              {Object.entries(NOTE_COLORS).map(([name, v]) => (
                <button
                  key={name}
                  onClick={() => onChange({ color: name })}
                  aria-label={name}
                  aria-pressed={item.color === name}
                  className={cn("size-3.5 rounded-full ring-1 ring-black/15", item.color === name && "ring-2 ring-black/40")}
                  style={{ background: v.bg }}
                />
              ))}
            </div>
          )}
        </div>
      );
    }
    case "reference":
      return (
        <div className="flex size-full flex-col">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" draggable={false} className="min-h-0 flex-1 object-cover object-top" />
          ) : (
            <div className="flex-1 bg-muted" />
          )}
          <div className="flex items-center gap-1 px-2 py-1.5 text-[12px] text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">Reference only</span>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()} aria-label={`Open ${item.title}`} className="rounded p-0.5 hover:bg-hover">
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      );
    case "palette":
      return (
        <div className="flex size-full gap-1 p-2 pt-0">
          {item.colors.map((c, i) => (
            <label key={i} className="relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-md ring-1 ring-black/10" style={{ background: c }}>
              <span className="sr-only">Colour {i + 1}</span>
              <input
                type="color"
                value={c}
                disabled={!canEdit}
                onChange={(e) => onChange({ colors: item.colors.map((x, j) => (j === i ? e.target.value : x)) })}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/30 px-1 text-center font-mono text-[10px] text-white">{c}</span>
            </label>
          ))}
        </div>
      );
  }
}
