"use client";

import { ChevronLeft, ChevronRight, Copy, ImageIcon, Layers, Loader2, Minus, Plus, Sparkles, Trash2, Type, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getPreset } from "@/lib/animations/presets";
import { readDragItem, type DragItem } from "@/lib/drag";
import { addScene, duplicateScene, moveScene, removeElement, removeScene, updateScene } from "@/lib/creative-spec/ops";
import type { CreativeSpecDoc, SpecElement, SpecScene } from "@/lib/creative-spec/schema";
import { cn } from "@/lib/utils";

const ELEMENT_LABEL: Record<SpecElement["type"], string> = { headline: "Headline", subtitle: "Subtitle", cta: "Button", image: "Image", logo: "Logo", lottie: "Animation" };
const ELEMENT_ICON: Record<SpecElement["type"], typeof Type> = { headline: Type, subtitle: Type, cta: Type, image: ImageIcon, logo: ImageIcon, lottie: Sparkles };

/**
 * The stack: scenes side by side, each a column of layers, like Riffle's
 * stacks of sounds. Drop anything from the library or the board onto a column
 * to put it in that scene.
 */
export function SceneStack({
  spec,
  selectedScene,
  hoverScene,
  canEdit,
  starting,
  onStart,
  onSelect,
  onEdit,
  onDropPayload,
}: {
  spec: CreativeSpecDoc | null;
  selectedScene: string | null;
  hoverScene: string | null;
  canEdit: boolean;
  starting: boolean;
  onStart: () => void;
  onSelect: (sceneId: string) => void;
  onEdit: (next: CreativeSpecDoc) => void;
  onDropPayload: (payload: DragItem, sceneId: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);

  if (!spec) {
    return (
      <section aria-label="Stack" className="flex h-full items-center justify-center gap-4 border-t bg-sidebar px-6">
        <Layers className="size-6 text-muted-foreground" aria-hidden />
        <p className="max-w-[52ch] text-[15px] text-muted-foreground">The stack is where the video comes together: scenes side by side, each with its layers. Start with three blank scenes.</p>
        {canEdit && (
          <Button onClick={onStart} disabled={starting}>
            {starting ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />}
            Start the stack
          </Button>
        )}
      </section>
    );
  }

  const step = (scene: SpecScene, delta: number) => onEdit(updateScene(spec, scene.id, { duration: Math.min(20, Math.max(0.5, Math.round((scene.duration + delta) * 2) / 2)) }));

  return (
    <section aria-label="Stack" className="flex h-full min-h-0 flex-col border-t bg-sidebar">
      <div className="flex items-center gap-2 px-4 pt-2 text-[13px] text-muted-foreground">
        <Layers className="size-3.5" aria-hidden />
        <span className="font-medium text-foreground">Stack</span>
        <span className="tabular">
          {spec.scenes.length} scenes · {spec.scenes.reduce((n, s) => n + s.duration, 0).toFixed(1)}s · {spec.aspect}
        </span>
        <span className="hidden sm:inline">· drop anything on a scene to add it</span>
      </div>
      <ol className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-4 py-2">
        {spec.scenes.map((scene, i) => {
          const active = selectedScene === scene.id;
          const hot = over === scene.id || hoverScene === scene.id;
          return (
            <li
              key={scene.id}
              data-scene-drop={scene.id}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setOver(scene.id);
              }}
              onDragLeave={() => setOver((o) => (o === scene.id ? null : o))}
              onDrop={(e) => {
                setOver(null);
                const payload = readDragItem(e);
                if (!payload || !canEdit) return;
                e.preventDefault();
                onDropPayload(payload, scene.id);
              }}
              className={cn(
                "group flex w-[200px] shrink-0 flex-col rounded-lg bg-card shadow-card ring-1 ring-black/5 transition",
                active && "ring-2 ring-foreground/60",
                hot && "ring-2 ring-tally bg-tally/5",
              )}
            >
              <button onClick={() => onSelect(scene.id)} className="flex items-center gap-2 border-b px-2.5 py-1.5 text-left" aria-pressed={active} aria-label={`Scene ${i + 1}, ${scene.purpose}, ${scene.duration} seconds`}>
                <span className="size-3 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: scene.background.color || spec.style.background }} aria-hidden />
                <span className="tabular text-[12px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium capitalize">{scene.purpose}</span>
              </button>
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
                {scene.background.preset && <Layer icon={Wand2} label={`BG · ${getPreset(scene.background.preset.presetId)?.name ?? scene.background.preset.presetId}`} />}
                {scene.elements.map((el) => (
                  <Layer
                    key={el.id}
                    icon={ELEMENT_ICON[el.type]}
                    label={el.text || ELEMENT_LABEL[el.type]}
                    sub={el.animation ? getPreset(el.animation.presetId)?.name : undefined}
                    onRemove={canEdit ? () => onEdit(removeElement(spec, el.id)) : undefined}
                  />
                ))}
                {hot && <li className="rounded-md border border-dashed border-tally px-2 py-1.5 text-center text-[12px] text-tally">Drop to add</li>}
              </ul>
              <div className="flex items-center gap-0.5 border-t px-1 py-1">
                {canEdit ? (
                  <>
                    <Button variant="ghost" size="icon-xs" onClick={() => step(scene, -0.5)} aria-label={`Shorten scene ${i + 1}`}>
                      <Minus />
                    </Button>
                    <span className="tabular w-9 text-center text-[12px]">{scene.duration}s</span>
                    <Button variant="ghost" size="icon-xs" onClick={() => step(scene, 0.5)} aria-label={`Lengthen scene ${i + 1}`}>
                      <Plus />
                    </Button>
                    <span className="flex-1" />
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(moveScene(spec, scene.id, -1))} disabled={i === 0} aria-label={`Move scene ${i + 1} earlier`}>
                      <ChevronLeft />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(moveScene(spec, scene.id, 1))} disabled={i === spec.scenes.length - 1} aria-label={`Move scene ${i + 1} later`}>
                      <ChevronRight />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(duplicateScene(spec, scene.id))} aria-label={`Duplicate scene ${i + 1}`}>
                      <Copy />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(removeScene(spec, scene.id))} disabled={spec.scenes.length <= 1} aria-label={`Delete scene ${i + 1}`}>
                      <Trash2 />
                    </Button>
                  </>
                ) : (
                  <span className="tabular px-1.5 text-[12px] text-muted-foreground">{scene.duration}s</span>
                )}
              </div>
              {scene.transition && i < spec.scenes.length - 1 && (
                <span className="sr-only">Transition: {getPreset(scene.transition.presetId)?.name}</span>
              )}
            </li>
          );
        })}
        {canEdit && spec.scenes.length < 24 && (
          <li className="shrink-0">
            <button onClick={() => onEdit(addScene(spec))} className="flex h-full w-[120px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[13px] text-muted-foreground hover:bg-hover hover:text-foreground">
              <Plus className="size-4" /> Scene
            </button>
          </li>
        )}
      </ol>
    </section>
  );
}

function Layer({ icon: Icon, label, sub, onRemove }: { icon: typeof Type; label: string; sub?: string; onRemove?: () => void }) {
  return (
    <li className="group/layer flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-[12px]">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove ${label}`} className="rounded p-0.5 opacity-0 group-hover/layer:opacity-100 hover:bg-hover focus-visible:opacity-100">
          <Trash2 className="size-3" />
        </button>
      )}
    </li>
  );
}
