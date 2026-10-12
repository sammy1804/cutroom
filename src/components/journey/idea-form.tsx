"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { ChipGroup } from "@/components/chip-group";
import { Field, firstErrors } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveIdeaAction } from "@/server/actions/journey";

const FORMATS = [
  { id: "9:16", label: "9:16 Reel / Story" },
  { id: "1:1", label: "1:1 Post" },
  { id: "4:5", label: "4:5 Feed" },
  { id: "16:9", label: "16:9 Film / Web" },
] as const;

export function IdeaForm({ slug, projectId, initial, canEdit }: { slug: string; projectId: string; initial: { idea: string; audience: string; format: string }; canEdit: boolean }) {
  const router = useRouter();
  const [idea, setIdea] = useState(initial.idea);
  const [audience, setAudience] = useState(initial.audience);
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>((FORMATS.find((f) => f.id === initial.format)?.id ?? "9:16") as "9:16");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveIdeaAction(slug, projectId, { idea, audience: audience || undefined, format });
          if (!res.ok) return void setErrors(firstErrors(res.fieldErrors));
          router.push(`/w/${slug}/projects/${projectId}?stage=explore`);
          router.refresh();
        });
      }}
      className="max-w-[720px] space-y-6"
      noValidate
    >
      <Field id="idea" label="The idea" error={errors.idea} hint="Say it the way you'd explain it to a friend. Rough is fine.">
        <Textarea id="idea" rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} disabled={!canEdit} className="text-[17px] leading-relaxed" placeholder="Construction waste isn't waste; it's the material for what we build next." />
      </Field>
      <Field id="audience" label="Who is it for?" optional error={errors.audience}>
        <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={!canEdit} className="h-10" placeholder="Architects and developers who care about embodied carbon" />
      </Field>
      <Field id="format" label="Main format">
        <ChipGroup id="format" options={FORMATS} value={[format]} onChange={(v) => v.length && setFormat(v[v.length - 1]!)} />
      </Field>
      {canEdit && (
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save and explore <ArrowRight data-icon="inline-end" />
        </Button>
      )}
    </form>
  );
}
