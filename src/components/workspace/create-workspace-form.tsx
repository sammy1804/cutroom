"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, firstErrors } from "@/components/field";
import { createWorkspaceAction } from "@/server/actions/workspace";
import { slugify } from "@/lib/slug";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const slug = slugify(name) || "your-studio";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createWorkspaceAction({ name });
      if (!result.ok) {
        setErrors({ name: firstErrors(result.fieldErrors).name ?? result.message });
        return;
      }
      router.push(`/w/${result.data.slug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field id="workspace-name" label="Workspace name" error={errors.name}>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Northlight Studio"
          aria-invalid={!!errors.name}
          className="h-10 text-[15px]"
          autoFocus
          maxLength={48}
        />
      </Field>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground">
        <span className="opacity-60">/w/</span>
        <span className="truncate text-foreground">{slug}</span>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || name.trim().length < 2}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Create workspace
        {!pending && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}
