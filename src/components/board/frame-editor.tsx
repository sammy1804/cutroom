"use client";

import { useEffect, useRef } from "react";
import { Copy, ImageIcon, Plus, Sparkles, Trash2, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPreset } from "@/lib/animations/presets";
import { LIBRARY_PRESETS as ANIMATION_PRESETS } from "@/lib/library/curation";
import type { BoardDoc, BoardFrame, BoardOp } from "@/lib/board";
import { frameSpec } from "@/lib/board-place";
import { addElement, removeElement, updateElement, updateScene } from "@/lib/creative-spec/ops";
import type { SpecElement, SpecScene } from "@/lib/creative-spec/schema";
import { cn } from "@/lib/utils";
import type { DrawerAsset } from "./library-drawer";

const PURPOSES: SpecScene["purpose"][] = ["hook", "context", "problem", "turn", "proof", "payoff", "cta", "outro"];
const LAYOUTS: SpecElement["layout"][] = ["center", "top", "bottom", "lower-left", "fullbleed"];
const byCategory = (c: string) => ANIMATION_PRESETS.filter((p) => p.category === c);
const TEXT_ANIMS = byCategory("text");
const IMAGE_ANIMS = byCategory("image");
const BG_ANIMS = byCategory("background");
const TEXT_LABEL: Partial<Record<SpecElement["type"], string>> = { headline: "Headline", subtitle: "Line", cta: "Button" };

/**
 * Edits the selected frame in place: words, look, media, motion and timing.
 * Every change is one frame operation, so collaborators see it within a second.
 */
export function FrameEditor({
  board,
  frame,
  index,
  assets,
  canEdit,
  autoFocusText,
  commit,
  onClose,
  onDuplicate,
  onDelete,
  style,
}: {
  board: BoardDoc;
  frame: BoardFrame;
  index: number | null;
  assets: DrawerAsset[];
  canEdit: boolean;
  autoFocusText: boolean;
  commit: (ops: BoardOp[]) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  style: React.CSSProperties;
}) {
  const spec = frameSpec(board, frame);
  const scene = frame.scene;
  const save = (next: typeof spec) => commit([{ t: "frame", frame: { ...frame, scene: next.scenes[0]! } }]);
  const setScene = (patch: Partial<SpecScene>) => save(updateScene(spec, scene.id, patch));
  const setEl = (id: string, patch: Partial<SpecElement>) => save(updateElement(spec, id, patch));
  const add = (type: SpecElement["type"], patch: Partial<SpecElement> = {}) => {
    const r = addElement(spec, scene.id, type);
    save(updateElement(r.spec, r.elementId, patch));
  };
  const texts = scene.elements.filter((e) => e.type === "headline" || e.type === "subtitle" || e.type === "cta");
  const media = scene.elements.filter((e) => e.type === "image" || e.type === "lottie" || e.type === "logo");
  const full = scene.elements.length >= 8;
  const firstText = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocusText) firstText.current?.focus();
  }, [autoFocusText, frame.id]);

  return (
    <div
      data-board-node
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="absolute z-30 flex max-h-[calc(100%-24px)] w-[300px] flex-col overflow-hidden rounded-xl bg-card shadow-xl ring-1 ring-black/10"
      style={style}
      role="dialog"
      aria-label={`Edit ${index ? `frame ${index}` : "draft frame"}`}
    >
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <p className="flex-1 text-[14px] font-semibold">{index ? `Frame ${index}` : "Draft frame"}</p>
        {canEdit && (
          <>
            <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="Duplicate frame">
              <Copy />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete frame">
              <Trash2 />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close editor">
          <X />
        </Button>
      </div>
      {!index && <p className="border-b bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">Not in the video yet. Drag from the dot on a frame&apos;s right edge to this one to connect it.</p>}

      <fieldset disabled={!canEdit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <Group title="Words">
          {texts.map((el, i) => (
            <div key={el.id} className="space-y-1.5 rounded-lg bg-muted/50 p-2">
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Type className="size-3.5" aria-hidden />
                <span className="flex-1">{TEXT_LABEL[el.type]}</span>
                <button onClick={() => save(removeElement(spec, el.id))} aria-label={`Remove ${TEXT_LABEL[el.type]}`} className="rounded p-0.5 hover:bg-hover">
                  <X className="size-3.5" />
                </button>
              </div>
              <label className="sr-only" htmlFor={`t-${el.id}`}>
                {TEXT_LABEL[el.type]} text
              </label>
              <textarea
                id={`t-${el.id}`}
                ref={i === 0 ? firstText : undefined}
                rows={2}
                maxLength={240}
                value={el.text ?? ""}
                onChange={(e) => setEl(el.id, { text: e.target.value })}
                className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-tally"
              />
              <div className="flex gap-1.5">
                <MiniSelect label="Position" value={el.layout} options={LAYOUTS.filter((l) => l !== "fullbleed").map((l) => [l, l])} onChange={(v) => setEl(el.id, { layout: v as SpecElement["layout"] })} />
                <MiniSelect label="Animation" value={el.animation?.presetId ?? ""} options={[["", "None"], ...TEXT_ANIMS.map((p) => [p.id, p.name] as [string, string])]} onChange={(v) => setEl(el.id, { animation: v ? { presetId: v, params: {} } : null })} />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                Size
                <input type="range" min={16} max={160} value={el.size ?? 64} onChange={(e) => setEl(el.id, { size: Number(e.target.value) })} className="flex-1 accent-[var(--tally)]" />
              </label>
            </div>
          ))}
          {!full && (
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" onClick={() => add(texts.some((t) => t.type === "headline") ? "subtitle" : "headline", { text: "New line" })}>
                <Plus /> Text
              </Button>
              <Button variant="ghost" size="xs" onClick={() => add("cta", { text: "Learn more" })}>
                <Plus /> Button
              </Button>
            </div>
          )}
        </Group>

        <Group title="Look">
          <div className="grid grid-cols-3 gap-2">
            <Swatch label="Background" value={scene.background.color} onChange={(v) => setScene({ background: { ...scene.background, color: v } })} />
            <Swatch label="Text (all)" value={board.style.foreground} onChange={(v) => commit([{ t: "meta", style: { ...board.style, foreground: v } }])} />
            <Swatch label="Accent (all)" value={board.style.accent} onChange={(v) => commit([{ t: "meta", style: { ...board.style, accent: v } }])} />
          </div>
          <MiniSelect
            label="Background motion"
            value={scene.background.preset?.presetId ?? ""}
            options={[["", "None"], ...BG_ANIMS.map((p) => [p.id, p.name] as [string, string])]}
            onChange={(v) => setScene({ background: { ...scene.background, preset: v ? { presetId: v, params: {} } : null } })}
            wide
          />
        </Group>

        <Group title="Media">
          {media.map((el) => (
            <div key={el.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              {el.type === "lottie" ? <Sparkles className="size-4 shrink-0 text-muted-foreground" /> : <ImageIcon className="size-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex gap-1.5">
                  <MiniSelect label="Position" value={el.layout} options={LAYOUTS.map((l) => [l, l])} onChange={(v) => setEl(el.id, { layout: v as SpecElement["layout"] })} />
                  <MiniSelect label="Animation" value={el.animation?.presetId ?? ""} options={[["", "None"], ...IMAGE_ANIMS.map((p) => [p.id, p.name] as [string, string])]} onChange={(v) => setEl(el.id, { animation: v ? { presetId: v, params: {} } : null })} />
                </div>
                {el.credit && <p className="truncate text-[11px] text-muted-foreground">Credit: {el.credit}</p>}
              </div>
              <button onClick={() => save(removeElement(spec, el.id))} aria-label="Remove media" className="rounded p-0.5 hover:bg-hover">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {!full && assets.length > 0 && (
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Add from this project's assets">
              {assets.slice(0, 15).map((a) => (
                <button
                  key={a.id}
                  onClick={() => add(a.kind === "animation" ? "lottie" : "image", { assetId: a.id, src: a.url, credit: a.credit ?? undefined, layout: a.kind === "animation" ? "center" : media.some((m) => m.type === "image") ? "center" : "fullbleed" })}
                  title={`Add ${a.name}`}
                  aria-label={`Add ${a.name}`}
                  className="aspect-square overflow-hidden rounded-md bg-muted ring-1 ring-black/5 hover:ring-2 hover:ring-tally"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.thumbnailUrl ?? a.url} alt="" className={cn("size-full", a.kind === "animation" ? "object-contain p-1" : "object-cover")} />
                </button>
              ))}
            </div>
          )}
          <p className="text-[12px] text-muted-foreground">Or drag images, textures and animations from the library onto the frame.</p>
        </Group>

        <Group title="Timing">
          <label className="flex items-center gap-2 text-[13px]">
            <span className="w-16 text-muted-foreground">Length</span>
            <input type="range" min={0.5} max={10} step={0.5} value={scene.duration} onChange={(e) => setScene({ duration: Number(e.target.value) })} className="flex-1 accent-[var(--tally)]" />
            <span className="tabular w-9 text-right">{scene.duration}s</span>
          </label>
          <MiniSelect label="Role" value={scene.purpose} options={PURPOSES.map((p) => [p, p])} onChange={(v) => setScene({ purpose: v as SpecScene["purpose"] })} wide />
          <MiniSelect
            label="Motion feel"
            value={scene.feel ?? "smooth"}
            options={[["smooth", "Smooth"], ["twos", "Stop-motion · on twos (12 fps)"], ["threes", "Stop-motion · on threes (8 fps)"]]}
            onChange={(v) => setScene({ feel: v as SpecScene["feel"] })}
            wide
          />
        </Group>
      </fieldset>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function MiniSelect({ label, value, options: given, onChange, wide }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; wide?: boolean }) {
  // A value from outside the curated list (older work) stays selectable rather than silently changing.
  const options: [string, string][] = value && !given.some(([v]) => v === value) ? [...given, [value, `${getPreset(value)?.name ?? value} (legacy)`]] : given;
  return (
    <label className={cn("flex min-w-0 flex-col gap-0.5 text-[11px] text-muted-foreground", wide ? "w-full" : "flex-1")}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-full min-w-0 rounded-md border bg-background px-1.5 text-[12px] text-foreground capitalize">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#888888";
  return (
    <label className="flex cursor-pointer flex-col gap-1 text-[11px] text-muted-foreground">
      {label}
      <span className="relative h-8 rounded-md ring-1 ring-black/10" style={{ background: safe }}>
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
      </span>
    </label>
  );
}
