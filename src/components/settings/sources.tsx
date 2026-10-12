"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addSourceAction, setSourceEnabledAction } from "@/server/actions/creative";
import { SOURCE_TYPE_LABEL } from "@/lib/sources";
import { cn } from "@/lib/utils";

export function SourceToggle({ slug, id, enabled, disabled, name }: { slug: string; id: string; enabled: boolean; disabled: boolean; name: string }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${on ? "Disable" : "Enable"} ${name}`}
      disabled={disabled || pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
          const res = await setSourceEnabledAction(slug, id, next);
          if (!res.ok) {
            setOn(!next);
            return void toast.error(res.message);
          }
          router.refresh();
        });
      }}
      className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40", on ? "border-tally bg-tally" : "bg-muted")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-[18px] rounded-full bg-background shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

export function AddSourceForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", url: "", type: "DESIGN_REFERENCE", purpose: "" });
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await addSourceAction(slug, form);
          if (!res.ok) return void toast.error(res.message);
          toast.success(`${form.name} added`);
          setForm({ name: "", url: "", type: "DESIGN_REFERENCE", purpose: "" });
          router.refresh();
        });
      }}
      className="grid gap-4 rounded-lg bg-card shadow-card p-5 sm:grid-cols-2"
    >
      <Field id="src-name" label="Name">
        <Input id="src-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" placeholder="Savee" />
      </Field>
      <Field id="src-url" label="URL">
        <Input id="src-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="h-9" placeholder="https://savee.it" />
      </Field>
      <Field id="src-type" label="Type">
        <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
          <SelectTrigger id="src-type" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="src-purpose" label="Purpose">
        <Input id="src-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="h-9" placeholder="Moodboards for art direction" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !form.name || !form.url || !form.purpose}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />}
          Add source
        </Button>
      </div>
    </form>
  );
}
