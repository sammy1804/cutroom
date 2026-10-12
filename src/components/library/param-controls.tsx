"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ParamDef, ParamValues } from "@/lib/animations/types";

const EASING_LABEL: Record<string, string> = {
  linear: "Linear",
  easeOut: "Ease out",
  easeInOut: "Ease in-out",
  expoOut: "Expo out",
  backOut: "Back out",
  spring: "Spring",
};

/** Form controls generated from a preset's parameter schema. */
export function ParamControls({
  schema,
  values,
  onChange,
}: {
  schema: Record<string, ParamDef>;
  values: ParamValues;
  onChange: (values: ParamValues) => void;
}) {
  const set = (key: string, value: ParamValues[string]) => onChange({ ...values, [key]: value });

  return (
    <div className="grid gap-5">
      {Object.entries(schema).map(([key, def]) => {
        const id = `param-${key}`;
        const value = values[key] ?? def.default;
        return (
          <div key={key} className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor={id} className="text-sm font-medium">
                {def.label}
              </label>
              {def.type === "number" && (
                <span className="tabular text-xs text-muted-foreground">
                  {Number(value).toFixed(def.step && def.step < 1 ? 2 : 0)}
                  {def.unit ?? ""}
                </span>
              )}
            </div>
            {def.type === "number" && (
              <input
                id={id}
                type="range"
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                value={Number(value)}
                onChange={(e) => set(key, Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--tally)]"
              />
            )}
            {def.type === "select" && (
              <Select value={String(value)} onValueChange={(v) => set(key, v)}>
                <SelectTrigger id={id} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {def.options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {EASING_LABEL[o] ?? o.charAt(0).toUpperCase() + o.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {def.type === "color" && (
              <div className="flex items-center gap-3">
                <input id={id} type="color" value={String(value)} onChange={(e) => set(key, e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1" />
                <span className="text-[13px] text-muted-foreground uppercase">{String(value)}</span>
              </div>
            )}
            {def.type === "text" && (
              <input
                id={id}
                type="text"
                value={String(value)}
                maxLength={def.maxLength ?? 140}
                onChange={(e) => set(key, e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            )}
            {def.type === "boolean" && (
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => set(key, e.target.checked)} className="size-4 accent-[var(--tally)]" />
                {value ? "On" : "Off"}
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
