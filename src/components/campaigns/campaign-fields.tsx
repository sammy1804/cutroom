"use client";

import { ChipGroup } from "@/components/chip-group";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASPECT_RATIOS, CHANNELS, OBJECTIVES } from "@/lib/validation";

type Objective = (typeof OBJECTIVES)[number]["id"];
type Channel = (typeof CHANNELS)[number]["id"];
type Ratio = (typeof ASPECT_RATIOS)[number];

export interface CampaignDraft {
  name: string;
  objective: Objective;
  brief: string;
  audience: string;
  channels: Channel[];
  aspectRatios: Ratio[];
  dueDate: string;
}

export const emptyCampaign: CampaignDraft = {
  name: "",
  objective: "awareness",
  brief: "",
  audience: "",
  channels: [],
  aspectRatios: ["9:16"],
  dueDate: "",
};

const RATIO_OPTIONS = ASPECT_RATIOS.map((r) => ({ id: r, label: r }));

export function CampaignFields({
  value,
  onChange,
  errors,
  compact = false,
}: {
  value: CampaignDraft;
  onChange: (value: CampaignDraft) => void;
  errors: Record<string, string>;
  compact?: boolean;
}) {
  const set = <K extends keyof CampaignDraft>(key: K, v: CampaignDraft[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
        <Field id="campaign-name" label="Campaign name" error={errors.name}>
          <Input
            id="campaign-name"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Autumn single-origin drop"
            aria-invalid={!!errors.name}
            className="h-9"
            maxLength={80}
          />
        </Field>
        <Field id="campaign-objective" label="Objective" error={errors.objective}>
          <Select value={value.objective} onValueChange={(v) => set("objective", v as Objective)}>
            <SelectTrigger id="campaign-objective" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field id="campaign-channels" label="Channels" error={errors.channels}>
        <ChipGroup id="campaign-channels" options={CHANNELS} value={value.channels} onChange={(v) => set("channels", v)} />
      </Field>

      <Field id="campaign-ratios" label="Formats" error={errors.aspectRatios} hint="Every deliverable is produced in each selected aspect ratio.">
        <ChipGroup id="campaign-ratios" mono options={RATIO_OPTIONS} value={value.aspectRatios} onChange={(v) => set("aspectRatios", v)} />
      </Field>

      {!compact && (
        <>
          <Field id="campaign-brief" label="Brief" optional error={errors.brief}>
            <Textarea
              id="campaign-brief"
              value={value.brief}
              onChange={(e) => set("brief", e.target.value)}
              placeholder="What are we making, why now, and what should viewers do after watching?"
              rows={4}
              maxLength={4000}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
            <Field id="campaign-audience" label="Audience" optional error={errors.audience}>
              <Input
                id="campaign-audience"
                value={value.audience}
                onChange={(e) => set("audience", e.target.value)}
                placeholder="Home brewers, 25–40, already buy specialty beans"
                className="h-9"
                maxLength={500}
              />
            </Field>
            <Field id="campaign-due" label="Due date" optional error={errors.dueDate}>
              <Input
                id="campaign-due"
                type="date"
                value={value.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                className="h-9 font-mono text-xs dark:[color-scheme:dark]"
              />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}
