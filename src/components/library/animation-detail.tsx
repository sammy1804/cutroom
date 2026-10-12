"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BookmarkPlus, Check, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { approveAnimationAction, applyAnimationAction, saveCustomPresetAction } from "@/server/actions/creative";
import { CATEGORY_LABEL, getPreset } from "@/lib/animations/presets";
import { defaultsOf, type ParamValues } from "@/lib/animations/types";
import type { AnimationRole } from "@/lib/creative-types";
import { AnimationPreview } from "./animation-preview";
import { ParamControls } from "./param-controls";

export interface CampaignOption {
  id: string;
  name: string;
  projectName: string;
}

export interface DetailTarget {
  presetId: string;
  params?: ParamValues;
  name?: string;
  customPresetId?: string;
}

const ROLE_BY_CATEGORY: Record<string, AnimationRole> = {
  text: "headline",
  image: "image",
  object: "object",
  transition: "transition",
  background: "background",
  "3d": "object",
};

const ROLES: { id: AnimationRole; label: string }[] = [
  { id: "headline", label: "Headline" },
  { id: "body", label: "Body text" },
  { id: "image", label: "Images" },
  { id: "object", label: "Objects" },
  { id: "transition", label: "Transitions" },
  { id: "background", label: "Background" },
];

export function AnimationDetail({
  slug,
  target,
  onClose,
  campaigns,
  defaultCampaignId,
  canEdit,
}: {
  slug: string;
  target: DetailTarget | null;
  onClose: () => void;
  campaigns: CampaignOption[];
  defaultCampaignId?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const preset = target ? getPreset(target.presetId) : undefined;
  const [params, setParams] = useState<ParamValues>({});
  const [text, setText] = useState("");
  const [presetName, setPresetName] = useState("");
  const [campaignId, setCampaignId] = useState(defaultCampaignId ?? campaigns[0]?.id ?? "");
  const [role, setRole] = useState<AnimationRole>("headline");
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!preset) return;
    setParams({ ...defaultsOf(preset), ...(target?.params ?? {}) });
    setPresetName(target?.customPresetId ? (target.name ?? "") : `${preset.name} (custom)`);
    setRole(ROLE_BY_CATEGORY[preset.category] ?? "headline");
    setText("");
  }, [preset, target]);

  if (!preset) return null;

  const run = (key: string, fn: () => Promise<{ ok: boolean; message?: string }>, success: string) => {
    setBusy(key);
    startTransition(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.ok) return void toast.error(res.message ?? "Something went wrong.");
      toast.success(success);
      router.refresh();
    });
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-[min(1040px,calc(100%-2rem))]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4 border-b p-5 lg:border-r lg:border-b-0 lg:p-6">
            <DialogHeader className="space-y-1.5">
              <p className="label-meta">
                {CATEGORY_LABEL[preset.category]} · v{preset.version}
                {target?.customPresetId ? " · custom" : ""}
              </p>
              <DialogTitle className="text-xl">{target?.name ?? preset.name}</DialogTitle>
              <DialogDescription>{preset.description}</DialogDescription>
            </DialogHeader>
            <AnimationPreview layers={[{ presetId: preset.id, params }]} text={text || undefined} mode="loop" controls className="rounded-lg border" />
            {preset.category === "text" && (
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Try your own words…" className="h-10" maxLength={60} />
            )}
            <div className="flex flex-wrap gap-1.5">
              {preset.moods.map((m) => (
                <span key={m} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6 p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Parameters</h3>
              <Button variant="ghost" size="sm" onClick={() => setParams(defaultsOf(preset))}>
                <RotateCcw data-icon="inline-start" /> Reset
              </Button>
            </div>
            <ParamControls schema={preset.parameters} values={params} onChange={setParams} />

            {canEdit && (
              <div className="mt-auto space-y-5 border-t pt-5">
                <div className="space-y-2.5">
                  <p className="text-sm font-medium">Apply to a campaign</p>
                  {campaigns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Create a campaign to apply animations to it.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                        <Select value={campaignId} onValueChange={setCampaignId}>
                          <SelectTrigger className="h-9 w-full min-w-0 [&_[data-slot=select-value]]:truncate" aria-label="Campaign">
                            <SelectValue placeholder="Campaign" />
                          </SelectTrigger>
                          <SelectContent>
                            {campaigns.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} · {c.projectName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={role} onValueChange={(v) => setRole(v as AnimationRole)}>
                          <SelectTrigger className="h-9 w-full" aria-label="Use for">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        disabled={pending || !campaignId}
                        onClick={() =>
                          run("apply", () => applyAnimationAction(slug, campaignId, { presetId: preset.id, role, params, customPresetId: target?.customPresetId, name: target?.name }), "Added to the campaign's creative spec")
                        }
                      >
                        {busy === "apply" ? <Loader2 className="animate-spin" /> : <Check data-icon="inline-start" />}
                        Apply
                      </Button>
                    </>
                  )}
                </div>

                <div className="space-y-2.5">
                  <p className="text-sm font-medium">Save as custom preset</p>
                  <div className="flex gap-2">
                    <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} className="h-9" aria-label="Preset name" maxLength={60} />
                    <Button
                      variant="outline"
                      className="h-9"
                      disabled={pending || presetName.trim().length < 2}
                      onClick={() => run("save", () => saveCustomPresetAction(slug, { basePresetId: preset.id, name: presetName, params }), "Custom preset saved")}
                    >
                      {busy === "save" ? <Loader2 className="animate-spin" /> : <BookmarkPlus />}
                      <span className="sr-only sm:not-sr-only">Save</span>
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={pending}
                  onClick={() =>
                    run("approve", () => approveAnimationAction(slug, { subjectId: target?.customPresetId ?? preset.id, name: target?.name ?? preset.name, presetId: preset.id, params }), "Saved to the company creative library")
                  }
                >
                  {busy === "approve" ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                  Approve for the company library
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
