"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronLeft, ChevronRight, Copy, ImageIcon, Loader2, Plus, ShieldCheck, Sparkles, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { ParamControls } from "@/components/library/param-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { qualityCheckAction, saveCompositionAction, saveSpecAction } from "@/server/actions/journey";
import { getPreset } from "@/lib/animations/presets";
import { LIBRARY_PRESETS as ANIMATION_PRESETS } from "@/lib/library/curation";
import { defaultsOf, type ParamValues } from "@/lib/animations/types";
import { SpecComposition } from "@/lib/creative-spec/composition";
import { addElement, addScene, duplicateScene, findElement, specCredits, moveScene, removeElement, removeScene, updateElement, updateScene, updateSpec } from "@/lib/creative-spec/ops";
import { sceneOffsets, specDimensions, totalFrames, type AnimationRef, type CreativeSpecDoc, type SpecElement, type SpecScene } from "@/lib/creative-spec/schema";
import type { QualityReport } from "@/lib/skill-types";
import { cn } from "@/lib/utils";

export type WorkbenchMode = "story" | "design" | "motion" | "final";
export interface PickableImage {
  id: string;
  name: string;
  url: string;
  /** Preview image for the picker (Lottie assets have a JSON url). */
  thumbnailUrl?: string | null;
  /** Credit line the licence requires, copied onto the element when picked. */
  credit?: string | null;
}

const PURPOSES: SpecScene["purpose"][] = ["hook", "context", "problem", "turn", "proof", "payoff", "cta", "outro"];
const LAYOUTS: SpecElement["layout"][] = ["center", "top", "bottom", "lower-left", "fullbleed"];
const ELEMENT_LABEL: Record<SpecElement["type"], string> = { headline: "Headline", subtitle: "Subtitle", cta: "Button", image: "Image", logo: "Logo", lottie: "Animation" };

export function SpecWorkbench({
  slug,
  projectId,
  initial,
  mode,
  images,
  animations = [],
  canEdit,
}: {
  slug: string;
  projectId: string;
  initial: CreativeSpecDoc;
  mode: WorkbenchMode;
  images: PickableImage[];
  animations?: PickableImage[];
  canEdit: boolean;
}) {
  const [spec, setSpec] = useState(initial);
  const [sceneSel, setSceneSel] = useState(initial.scenes[0]!.id);
  const [elementSel, setElementSel] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const player = useRef<PlayerRef>(null);
  const dirty = useRef(false);
  const { width, height } = specDimensions(spec);
  const offsets = useMemo(() => sceneOffsets(spec), [spec]);
  const scene = spec.scenes.find((s) => s.id === sceneSel) ?? spec.scenes[0]!;
  const selected = findElement(spec, elementSel);

  // Autosave edits (debounced). The spec is the source of truth, so every change persists.
  useEffect(() => {
    if (!dirty.current || !canEdit) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const res = await saveSpecAction(slug, projectId, spec);
      setSaveState(res.ok ? "saved" : "error");
      if (!res.ok) toast.error(res.message);
    }, 700);
    return () => clearTimeout(t);
  }, [spec, slug, projectId, canEdit]);

  const edit = useCallback((next: CreativeSpecDoc) => {
    dirty.current = true;
    setSpec(next);
  }, []);

  const selectScene = (id: string, seek = true) => {
    setSceneSel(id);
    setElementSel(null);
    const o = offsets.find((x) => x.id === id);
    if (seek && o) player.current?.seekTo(o.from + Math.min(o.frames - 1, 15));
  };

  const step = (delta: number) => {
    const p = player.current;
    if (!p) return;
    p.pause();
    p.seekTo(Math.max(0, Math.min(totalFrames(spec) - 1, p.getCurrentFrame() + delta)));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <div className={cn("mx-auto overflow-hidden rounded-lg bg-black shadow-card", spec.aspect === "16:9" ? "w-full" : spec.aspect === "9:16" ? "w-full max-w-[380px]" : "w-full max-w-[560px]")}>
          <Player
            ref={player}
            component={SpecComposition}
            inputProps={{ spec, highlight: mode === "final" ? null : elementSel }}
            durationInFrames={totalFrames(spec)}
            fps={spec.fps}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
            controls
            loop
            acknowledgeRemotionLicense
          />
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous frame">
            <ChevronLeft />
          </Button>
          Frame step
          <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next frame">
            <ChevronRight />
          </Button>
          <span className="ml-3 tabular">
            {(totalFrames(spec) / spec.fps).toFixed(1)}s · {spec.scenes.length} scenes · {spec.aspect}
          </span>
          {canEdit && <span className="ml-3 text-[13px]">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}</span>}
        </div>

        <ol className="flex gap-2 overflow-x-auto pb-2" aria-label="Scenes">
          {spec.scenes.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <button
                onClick={() => selectScene(s.id)}
                aria-current={s.id === scene.id}
                className={cn("flex w-44 flex-col gap-1 rounded-lg p-3 text-left shadow-card transition-colors hover:bg-hover", s.id === scene.id ? "bg-card ring-2 ring-tally" : "bg-card")}
              >
                <span className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>
                    {String(i + 1).padStart(2, "0")} · {s.purpose}
                  </span>
                  <span className="tabular">{s.duration}s</span>
                </span>
                <span className="line-clamp-2 text-[15px] font-medium">{s.elements.find((e) => e.text)?.text ?? "(no text)"}</span>
              </button>
            </li>
          ))}
          {canEdit && mode === "story" && (
            <li className="shrink-0">
              <button onClick={() => edit(addScene(spec, scene.id))} className="flex h-full min-h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-hover">
                <Plus className="size-4" /> Add scene
              </button>
            </li>
          )}
        </ol>
      </div>

      <aside className="space-y-6" aria-label="Inspector">
        {mode === "final" ? (
          <FinalPanel slug={slug} projectId={projectId} spec={spec} canEdit={canEdit} onTarget={(t) => (t.includes(".") ? (setSceneSel(t.split(".")[0]!), setElementSel(t)) : t.startsWith("scene_") && selectScene(t))} />
        ) : (
          <>
            <SceneHeader spec={spec} scene={scene} mode={mode} canEdit={canEdit} edit={edit} onSelectScene={selectScene} />
            <ElementList scene={scene} spec={spec} mode={mode} canEdit={canEdit} selected={elementSel} onSelect={setElementSel} edit={edit} />
            {selected && <ElementInspector spec={spec} element={selected.element} mode={mode} images={images} animations={animations} canEdit={canEdit} edit={edit} />}
          </>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg bg-card p-4 shadow-card">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Labeled({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function PresetSelect({ id, category, value, onChange, allowNone = true, disabled }: { id: string; category: string; value: AnimationRef | null; onChange: (v: AnimationRef | null) => void; allowNone?: boolean; disabled?: boolean }) {
  const options = ANIMATION_PRESETS.filter((p) => p.category === category);
  return (
    <Select
      value={value?.presetId ?? "none"}
      disabled={disabled}
      onValueChange={(v) => {
        if (v === "none") return onChange(null);
        const preset = getPreset(v)!;
        onChange({ presetId: v, params: defaultsOf(preset) });
      }}
    >
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">None</SelectItem>}
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColorField({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <span className="flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground uppercase">{value}</span>
        <input id={id} type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5" />
      </span>
    </div>
  );
}

function SceneHeader({ spec, scene, mode, canEdit, edit, onSelectScene }: { spec: CreativeSpecDoc; scene: SpecScene; mode: WorkbenchMode; canEdit: boolean; edit: (s: CreativeSpecDoc) => void; onSelectScene: (id: string, seek?: boolean) => void }) {
  const set = (patch: Partial<SpecScene>) => edit(updateScene(spec, scene.id, patch));
  return (
    <Section title={`Scene ${scene.id.slice(-2)}`}>
      {mode === "story" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Purpose" htmlFor="scene-purpose">
              <Select value={scene.purpose} onValueChange={(v) => set({ purpose: v as SpecScene["purpose"] })} disabled={!canEdit}>
                <SelectTrigger id="scene-purpose" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labeled>
            <Labeled label={`Duration · ${scene.duration}s`} htmlFor="scene-duration">
              <input id="scene-duration" type="range" min={0.5} max={8} step={0.1} value={scene.duration} disabled={!canEdit} onChange={(e) => set({ duration: Number(e.target.value) })} className="mt-3 w-full accent-[var(--tally)]" />
            </Labeled>
          </div>
          <Labeled label="Notes" htmlFor="scene-notes">
            <Textarea id="scene-notes" rows={2} value={scene.notes ?? ""} disabled={!canEdit} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="Camera, visual, audio cues" />
          </Labeled>
          {canEdit && (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => edit(moveScene(spec, scene.id, -1))}>
                <ArrowUp /> Earlier
              </Button>
              <Button variant="ghost" size="sm" onClick={() => edit(moveScene(spec, scene.id, 1))}>
                <ArrowDown /> Later
              </Button>
              <Button variant="ghost" size="sm" onClick={() => edit(duplicateScene(spec, scene.id))}>
                <Copy /> Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={spec.scenes.length <= 1}
                onClick={() => {
                  edit(removeScene(spec, scene.id));
                  onSelectScene(spec.scenes[0]!.id === scene.id ? spec.scenes[1]!.id : spec.scenes[0]!.id, false);
                }}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          )}
        </>
      )}
      {mode === "design" && (
        <>
          <ColorField id="style-bg" label="Page colour" value={spec.style.background} onChange={(v) => edit(updateSpec(spec, { style: { ...spec.style, background: v } }))} disabled={!canEdit} />
          <ColorField id="style-fg" label="Text colour" value={spec.style.foreground} onChange={(v) => edit(updateSpec(spec, { style: { ...spec.style, foreground: v } }))} disabled={!canEdit} />
          <ColorField id="style-accent" label="Accent" value={spec.style.accent} onChange={(v) => edit(updateSpec(spec, { style: { ...spec.style, accent: v } }))} disabled={!canEdit} />
          <Labeled label="Typeface" htmlFor="style-font">
            <Select value={spec.style.font} onValueChange={(v) => edit(updateSpec(spec, { style: { ...spec.style, font: v as "sans" } }))} disabled={!canEdit}>
              <SelectTrigger id="style-font" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Sans</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="mono">Mono</SelectItem>
              </SelectContent>
            </Select>
          </Labeled>
          <div className="border-t pt-3">
            <ColorField id="scene-bg" label="This scene's background" value={scene.background.color} onChange={(v) => set({ background: { ...scene.background, color: v } })} disabled={!canEdit} />
          </div>
          <Labeled label="Animated background" htmlFor="scene-bg-preset">
            <PresetSelect id="scene-bg-preset" category="background" value={scene.background.preset} onChange={(v) => set({ background: { ...scene.background, preset: v } })} disabled={!canEdit} />
          </Labeled>
        </>
      )}
      {mode === "motion" && (
        <>
          <Labeled label="Transition to next scene" htmlFor="scene-transition">
            <PresetSelect id="scene-transition" category="transition" value={scene.transition} onChange={(v) => set({ transition: v })} disabled={!canEdit || spec.scenes.at(-1)!.id === scene.id} />
          </Labeled>
          {scene.transition && <Params value={scene.transition} onChange={(v) => set({ transition: v })} disabled={!canEdit} />}
          {scene.background.preset && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Background · {getPreset(scene.background.preset.presetId)?.name}</p>
              <Params value={scene.background.preset} onChange={(v) => set({ background: { ...scene.background, preset: v } })} disabled={!canEdit} />
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function Params({ value, onChange, disabled }: { value: AnimationRef; onChange: (v: AnimationRef) => void; disabled?: boolean }) {
  const preset = getPreset(value.presetId);
  if (!preset) return null;
  const schema = Object.fromEntries(Object.entries(preset.parameters).filter(([, d]) => d.type !== "text"));
  return (
    <fieldset disabled={disabled}>
      <ParamControls schema={schema} values={{ ...defaultsOf(preset), ...value.params } as ParamValues} onChange={(params) => onChange({ ...value, params })} />
    </fieldset>
  );
}

function ElementList({ scene, spec, mode, canEdit, selected, onSelect, edit }: { scene: SpecScene; spec: CreativeSpecDoc; mode: WorkbenchMode; canEdit: boolean; selected: string | null; onSelect: (id: string | null) => void; edit: (s: CreativeSpecDoc) => void }) {
  const add = (type: SpecElement["type"]) => {
    const r = addElement(spec, scene.id, type);
    edit(r.spec);
    onSelect(r.elementId);
  };
  return (
    <Section title="Elements">
      <ul className="space-y-1">
        {scene.elements.map((e) => (
          <li key={e.id}>
            <button onClick={() => onSelect(e.id === selected ? null : e.id)} className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[15px] hover:bg-hover", e.id === selected && "bg-muted")} aria-pressed={e.id === selected}>
              {e.type === "lottie" ? <Sparkles className="size-4 text-muted-foreground" /> : e.type === "image" || e.type === "logo" ? <ImageIcon className="size-4 text-muted-foreground" /> : <Type className="size-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{e.text || ELEMENT_LABEL[e.type]}</span>
              <span className="text-[12px] text-muted-foreground">{e.id}</span>
            </button>
          </li>
        ))}
      </ul>
      {canEdit && (mode === "story" || mode === "design") && (
        <div className="flex flex-wrap gap-1 border-t pt-3">
          {(mode === "story" ? (["headline", "subtitle", "cta"] as const) : (["image", "logo", "lottie"] as const)).map((t) => (
            <Button key={t} variant="ghost" size="sm" onClick={() => add(t)}>
              <Plus /> {ELEMENT_LABEL[t]}
            </Button>
          ))}
        </div>
      )}
    </Section>
  );
}

function ElementInspector({ spec, element, mode, images, animations, canEdit, edit }: { spec: CreativeSpecDoc; element: SpecElement; mode: WorkbenchMode; images: PickableImage[]; animations: PickableImage[]; canEdit: boolean; edit: (s: CreativeSpecDoc) => void }) {
  const set = (patch: Partial<SpecElement>) => edit(updateElement(spec, element.id, patch));
  const isText = element.type !== "image" && element.type !== "logo" && element.type !== "lottie";
  const isLottie = element.type === "lottie";
  const choices = isLottie ? animations : images;
  return (
    <Section title={ELEMENT_LABEL[element.type]}>
      {mode === "story" && isText && (
        <Labeled label="Text" htmlFor="el-text">
          <Textarea id="el-text" rows={2} value={element.text ?? ""} disabled={!canEdit} maxLength={240} onChange={(e) => set({ text: e.target.value })} />
        </Labeled>
      )}
      {mode === "design" && (
        <>
          <Labeled label="Position" htmlFor="el-layout">
            <Select value={element.layout} onValueChange={(v) => set({ layout: v as SpecElement["layout"] })} disabled={!canEdit}>
              <SelectTrigger id="el-layout" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUTS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
          {isText && (
            <Labeled label={`Size · ${element.size ?? 64}px`} htmlFor="el-size">
              <input id="el-size" type="range" min={16} max={160} value={element.size ?? 64} disabled={!canEdit} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full accent-[var(--tally)]" />
            </Labeled>
          )}
          {!isText && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{isLottie ? "Animation" : "Image"}</p>
              {choices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isLottie
                    ? "No animations in this project yet. Add some from Library → Open library."
                    : "No approved images in this project yet. Find some in Library → Free assets or Open library and add them to this project."}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {choices.map((img) => (
                    <button
                      key={img.id}
                      disabled={!canEdit}
                      onClick={() => set({ assetId: img.id, src: img.url, credit: img.credit ?? undefined })}
                      aria-pressed={element.assetId === img.id}
                      className={cn("aspect-square overflow-hidden rounded-md bg-muted", element.assetId === img.id && "ring-2 ring-tally")}
                      title={img.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumbnailUrl ?? img.url} alt={img.name} className={cn("size-full", isLottie ? "object-contain p-1.5" : "object-cover")} />
                    </button>
                  ))}
                </div>
              )}
              {element.credit && <p className="text-[13px] text-muted-foreground">Credit required: {element.credit}</p>}
            </div>
          )}
        </>
      )}
      {mode === "motion" && (
        <>
          <Labeled label="Animation" htmlFor="el-anim">
            <PresetSelect id="el-anim" category={isText ? "text" : "image"} value={element.animation} onChange={(v) => set({ animation: v })} disabled={!canEdit} />
          </Labeled>
          {element.animation && <Params value={element.animation} onChange={(v) => set({ animation: v })} disabled={!canEdit} />}
        </>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => edit(removeElement(spec, element.id))}>
          <Trash2 /> Remove element
        </Button>
      )}
    </Section>
  );
}

function FinalPanel({ slug, projectId, spec, canEdit, onTarget }: { slug: string; projectId: string; spec: CreativeSpecDoc; canEdit: boolean; onTarget: (target: string) => void }) {
  const router = useRouter();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [name, setName] = useState(spec.title);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const check = () => {
    setBusy("qc");
    startTransition(async () => {
      const res = await qualityCheckAction(slug, projectId);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      setReport(res.data);
    });
  };
  const save = () => {
    setBusy("save");
    startTransition(async () => {
      const res = await saveCompositionAction(slug, projectId, name);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      toast.success("Saved to the library. Reuse it from Library → Templates.");
      router.refresh();
    });
  };

  return (
    <>
      <Section title="Quality check">
        <p className="text-sm text-muted-foreground">Reading time, hook timing, contrast, missing images and broken presets.</p>
        <Button variant="outline" onClick={check} disabled={pending}>
          {busy === "qc" ? <Loader2 className="animate-spin" /> : <ShieldCheck data-icon="inline-start" />}
          Check this piece
        </Button>
        {report && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-[15px]">
              Score <span className="font-semibold tabular">{report.score}</span>/100 · {report.issues.length === 0 ? "no issues" : `${report.issues.length} to look at`}
            </p>
            <ul className="space-y-2">
              {report.issues.map((i, n) => (
                <li key={n} className="rounded-md bg-muted px-3 py-2 text-sm">
                  <button className="text-left" onClick={() => onTarget(i.target)}>
                    <span className={cn("font-medium", i.severity === "error" ? "text-destructive" : i.severity === "warning" ? "text-foreground" : "text-muted-foreground")}>{i.severity}</span> · {i.target} · {i.message}
                    {i.fix && <span className="block text-muted-foreground">{i.fix}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
      {canEdit && (
        <Section title="Save to library">
          <p className="text-sm text-muted-foreground">Saves this composition so it can be reused as a template for new projects.</p>
          <label htmlFor="comp-name" className="sr-only">
            Name
          </label>
          <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" maxLength={80} />
          <Button onClick={save} disabled={pending || name.trim().length < 2}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <BookmarkPlus data-icon="inline-start" />}
            Save to library
          </Button>
        </Section>
      )}
      <Credits spec={spec} />
      <Section title="Export">
        <p className="text-sm text-muted-foreground">Rendering to MP4 is not built yet. It arrives with render jobs (Phase 10). The preview above is the exact composition that will render.</p>
      </Section>
    </>
  );
}

function Credits({ spec }: { spec: CreativeSpecDoc }) {
  const credits = specCredits(spec);
  if (!credits.length) return null;
  return (
    <Section title="Credits">
      <p className="text-sm text-muted-foreground">These assets&apos; licences require attribution. Put these lines in the post caption or on the end card.</p>
      <ul className="space-y-1 text-[15px]">
        {credits.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(credits.join("\n")).then(() => toast.success("Credits copied"))}>
        <Copy data-icon="inline-start" /> Copy credits
      </Button>
    </Section>
  );
}
