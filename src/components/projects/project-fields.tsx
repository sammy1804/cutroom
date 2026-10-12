"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { PROJECT_COLORS } from "@/lib/validation";
import { cn } from "@/lib/utils";

export interface ProjectDraft {
  name: string;
  description: string;
  websiteUrl: string;
  color: (typeof PROJECT_COLORS)[number];
}

export const emptyProject: ProjectDraft = { name: "", description: "", websiteUrl: "", color: PROJECT_COLORS[0] };

export function ProjectFields({
  value,
  onChange,
  errors,
}: {
  value: ProjectDraft;
  onChange: (value: ProjectDraft) => void;
  errors: Record<string, string>;
}) {
  const set = <K extends keyof ProjectDraft>(key: K, v: ProjectDraft[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-5">
      <Field id="project-name" label="Project name" error={errors.name} hint="Usually the brand or product name.">
        <Input
          id="project-name"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Halden Coffee Roasters"
          aria-invalid={!!errors.name}
          className="h-9"
          maxLength={80}
          autoFocus
        />
      </Field>
      <Field id="project-description" label="Description" optional error={errors.description}>
        <Textarea
          id="project-description"
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Specialty roaster, DTC subscriptions. Tone: warm, a little nerdy."
          rows={3}
          maxLength={500}
          aria-invalid={!!errors.description}
        />
      </Field>
      <Field id="project-url" label="Website" optional error={errors.websiteUrl} hint="Used later to ground research in the brand.">
        <Input
          id="project-url"
          value={value.websiteUrl}
          onChange={(e) => set("websiteUrl", e.target.value)}
          placeholder="haldencoffee.com"
          inputMode="url"
          aria-invalid={!!errors.websiteUrl}
          className="h-9"
        />
      </Field>
      <Field id="project-color" label="Label colour">
        <div id="project-color" role="radiogroup" className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={value.color === color}
              aria-label={color}
              onClick={() => set("color", color)}
              className={cn(
                "size-6 rounded-md ring-1 ring-black/10 ring-inset outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                value.color === color && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}
