"use client";

import { useMemo, useState, useTransition } from "react";
import { Layers, Loader2, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCustomPresetAction, searchAnimationsAction } from "@/server/actions/creative";
import type { AnimationSearchResult } from "@/lib/skill-types";
import { CATEGORY_LABEL, getPreset } from "@/lib/animations/presets";
import { CURATED_ANIMATIONS, CURATED_TRANSITIONS } from "@/lib/library/curation";
import { ANIMATION_GROUPS, TRANSITION_GROUPS } from "@/lib/library/taxonomy";
import type { ParamValues } from "@/lib/animations/types";
import { setDragItem } from "@/lib/drag";
import { cn } from "@/lib/utils";
import { AnimationDetail, type CampaignOption, type DetailTarget } from "./animation-detail";
import { AnimationPreview } from "./animation-preview";

export interface CustomPresetSummary {
  id: string;
  basePresetId: string;
  name: string;
  params: Record<string, unknown>;
}

// Groups appear once they have curated content; no empty shelves.
const ANIMATION_FILTERS = ["all", ...ANIMATION_GROUPS.map((g) => g.id).filter((id) => CURATED_ANIMATIONS.some((c) => c.group === id)), "custom"];
const TRANSITION_FILTERS = ["all", ...TRANSITION_GROUPS.filter((g) => CURATED_TRANSITIONS.some((c) => c.subgroup === g))];
type Filter = string;
const filterLabel = (f: string) => (f === "all" ? "All" : f === "custom" ? "Custom" : (ANIMATION_GROUPS.find((g) => g.id === f)?.label ?? f));

export function AnimationsPanel({
  slug,
  customPresets,
  campaigns,
  projectId,
  defaultCampaignId,
  canEdit,
  aiEnabled,
  mode = "animations",
}: {
  slug: string;
  customPresets: CustomPresetSummary[];
  campaigns: CampaignOption[];
  projectId?: string;
  defaultCampaignId?: string;
  canEdit: boolean;
  aiEnabled: boolean;
  mode?: "animations" | "transitions";
}) {
  const FILTERS: readonly Filter[] = mode === "transitions" ? TRANSITION_FILTERS : ANIMATION_FILTERS;
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AnimationSearchResult | null>(null);
  const [searching, startSearch] = useTransition();

  const presets = useMemo(() => {
    if (filter === "custom") return [];
    const needle = text.trim().toLowerCase();
    const pool = mode === "transitions" ? CURATED_TRANSITIONS : CURATED_ANIMATIONS;
    return pool
      .filter((c) => filter === "all" || c.group === filter || c.subgroup === filter)
      .map((c) => c.preset)
      .filter((p) => !needle || `${p.name} ${p.description} ${p.moods.join(" ")}`.toLowerCase().includes(needle));
  }, [filter, text, mode]);

  const customs = mode === "animations" && (filter === "all" || filter === "custom") ? customPresets : [];

  function askClaude(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    startSearch(async () => {
      const res = await searchAnimationsAction(slug, query, { projectId });
      if (!res.ok) return void toast.error(res.message);
      setResult(res.data);
    });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={askClaude} className="relative overflow-hidden rounded-lg bg-card shadow-card p-1.5">
        <div className="flex items-center gap-2">
          <Wand2 className="ml-3 size-5 shrink-0 text-tally" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={aiEnabled ? "Describe a feel: “a subtle editorial headline reveal”, “a transition that feels liquid”…" : "Connect Claude to search by feel"}
            disabled={!aiEnabled}
            className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Describe the animation you want"
          />
          <Button type="submit" size="lg" disabled={!aiEnabled || searching || query.trim().length < 2} className="shrink-0">
            {searching ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
            Find
          </Button>
        </div>
      </form>

      {result && (
        <section className="space-y-4" aria-label="Recommendations">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-muted-foreground">{result.interpretation}</p>
            <button className="shrink-0 text-sm text-muted-foreground hover:text-foreground" onClick={() => setResult(null)}>
              Clear
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.recommendations.map((r) => (
              <PresetCard
                key={r.presetId}
                presetId={r.presetId}
                name={r.name}
                note={r.why}
                params={r.params}
                onOpen={() => setDetail({ presetId: r.presetId, params: r.params })}
                highlight
              />
            ))}
          </div>
          {result.combinations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Layers className="size-4 text-tally" /> Combinations
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.combinations.map((c) => (
                  <div key={c.name} className="overflow-hidden rounded-lg bg-card shadow-card">
                    <AnimationPreview layers={c.layers} />
                    <div className="space-y-2 p-4">
                      <p className="font-medium">{c.name}</p>
                      <p className="font-mono text-xs text-tally">{c.layers.map((l) => getPreset(l.presetId)?.name).join(" + ")}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{c.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Animation category">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-full border px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                filter === f && "border-tally/60 bg-tally/10 text-foreground",
              )}
            >
              {f === "custom" ? `Custom (${customPresets.length})` : filterLabel(f)}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by name or mood" className="h-9 pl-9" aria-label="Filter animations" />
        </div>
      </div>

      {customs.length > 0 && (
        <section className="space-y-3">
          {filter === "all" && <h3 className="label-meta">Your presets</h3>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {customs.map((c) => (
              <PresetCard
                key={c.id}
                presetId={c.basePresetId}
                name={c.name}
                note={`Based on ${getPreset(c.basePresetId)?.name}`}
                params={c.params as ParamValues}
                customPresetId={c.id}
                onOpen={() => setDetail({ presetId: c.basePresetId, params: c.params as ParamValues, name: c.name, customPresetId: c.id })}
                onDelete={canEdit ? () => deleteCustomPresetAction(slug, c.id).then((r) => (r.ok ? toast.success("Preset deleted") : toast.error(r.message))) : undefined}
              />
            ))}
          </div>
        </section>
      )}
      {filter === "custom" && customs.length === 0 && (
        <p className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          No custom presets yet. Open any animation, adjust its parameters and save it as your own.
        </p>
      )}

      {presets.length > 0 && (
        <section className="space-y-3">
          {filter === "all" && customs.length > 0 && <h3 className="label-meta">Library</h3>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {presets.map((p) => (
              <PresetCard key={p.id} presetId={p.id} name={p.name} note={p.description} onOpen={() => setDetail({ presetId: p.id })} />
            ))}
          </div>
        </section>
      )}
      {filter !== "custom" && presets.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches “{text}”.</p>}

      <AnimationDetail slug={slug} target={detail} onClose={() => setDetail(null)} campaigns={campaigns} defaultCampaignId={defaultCampaignId} canEdit={canEdit} />
    </div>
  );
}

function PresetCard({
  presetId,
  name,
  note,
  params,
  customPresetId,
  onOpen,
  onDelete,
  highlight,
}: {
  presetId: string;
  name: string;
  note: string;
  params?: ParamValues;
  customPresetId?: string;
  onOpen: () => void;
  onDelete?: () => void;
  highlight?: boolean;
}) {
  const preset = getPreset(presetId);
  if (!preset) return null;
  return (
    <div
      draggable
      onDragStart={(e) => setDragItem(e, { type: "animation", presetId, params: params ?? {}, name, customPresetId })}
      className={cn("group overflow-hidden rounded-lg bg-card shadow-card transition-colors hover:bg-hover", highlight && "border-tally/40")}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <AnimationPreview layers={[{ presetId, params }]} />
        <div className="space-y-1.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{name}</span>
            <span className="label-meta shrink-0">{preset.category === "3d" ? "3D" : CATEGORY_LABEL[preset.category]}</span>
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{note}</p>
        </div>
      </button>
      {onDelete && (
        <div className="flex justify-end border-t px-2 py-1.5">
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${name}`}>
            <Trash2 /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}
