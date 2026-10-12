"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChipGroup } from "@/components/chip-group";
import { Field, firstErrors } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createJourneyProjectAction } from "@/server/actions/journey";

const FORMATS = [
  { id: "9:16", label: "9:16 Reel / Story" },
  { id: "1:1", label: "1:1 Post" },
  { id: "4:5", label: "4:5 Feed" },
  { id: "16:9", label: "16:9 Film / Web" },
] as const;

/** CREATE → IDEA: a project starts with what it's trying to say. */
export function NewProjectFlow({ slug }: { slug: string; workspaceName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("9:16");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-10 px-5 py-10 sm:px-8 sm:py-16">
      <div className="space-y-2">
        <p className="label-meta">New project · Idea</p>
        <h1 className="text-[32px] leading-tight font-bold sm:text-[40px]">What are you trying to say?</h1>
        <p className="text-[16px] text-muted-foreground">Rough is fine. You&apos;ll research it, pick a direction and shape the story next.</p>
      </div>
      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await createJourneyProjectAction(slug, { name, idea, format, websiteUrl: website });
            if (!res.ok) {
              setErrors(firstErrors(res.fieldErrors));
              if (!res.fieldErrors) toast.error(res.message);
              return;
            }
            router.push(`/w/${slug}/projects/${res.data.projectId}?stage=explore`);
          });
        }}
      >
        <Field id="np-idea" label="The idea" error={errors.idea}>
          <Textarea id="np-idea" rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} autoFocus className="text-[17px] leading-relaxed" placeholder="Construction waste isn't waste; it's the material for what we build next." />
        </Field>
        <Field id="np-name" label="Project name" error={errors.name}>
          <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" placeholder="Second Life" maxLength={80} />
        </Field>
        <Field id="np-format" label="Main format">
          <ChipGroup id="np-format" options={FORMATS} value={[format]} onChange={(v) => v.length && setFormat(v[v.length - 1]!)} />
        </Field>
        <Field id="np-site" label="Brand website" optional error={errors.websiteUrl} hint="Lets the research agent capture the brand's own pages.">
          <Input id="np-site" value={website} onChange={(e) => setWebsite(e.target.value)} className="h-10" placeholder="example.com" inputMode="url" />
        </Field>
        <div className="flex items-center justify-between gap-3 border-t pt-6">
          <Button variant="ghost" asChild>
            <Link href={`/w/${slug}/projects`}>Cancel</Link>
          </Button>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Create and explore <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </form>
    </div>
  );
}
