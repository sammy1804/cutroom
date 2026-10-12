"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { draftStoryboardAction, startBlankSpecAction } from "@/server/actions/journey";

export function StoryStart({ slug, projectId, hasDirection, aiEnabled, canEdit, redraft = false }: { slug: string; projectId: string; hasDirection: boolean; aiEnabled: boolean; canEdit: boolean; redraft?: boolean }) {
  const router = useRouter();
  const [length, setLength] = useState("15");
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"ai" | "blank" | null>(null);
  if (!canEdit) return null;
  const run = (kind: "ai" | "blank") => {
    setBusy(kind);
    startTransition(async () => {
      const res = kind === "ai" ? await draftStoryboardAction(slug, projectId, Number(length)) : await startBlankSpecAction(slug, projectId);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={length} onValueChange={setLength}>
        <SelectTrigger className="h-10 w-[120px]" aria-label="Target length">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["6", "10", "15", "20", "30"].map((s) => (
            <SelectItem key={s} value={s}>
              {s} seconds
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="lg" onClick={() => run("ai")} disabled={!aiEnabled || !hasDirection || pending}>
        {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
        {redraft ? "Redraft storyboard" : "Draft the storyboard"}
      </Button>
      {!redraft && (
        <Button size="lg" variant="outline" onClick={() => run("blank")} disabled={pending}>
          {busy === "blank" ? <Loader2 className="animate-spin" /> : <FilePlus2 data-icon="inline-start" />}
          Start from a blank template
        </Button>
      )}
      <span className="text-[15px] text-muted-foreground">{busy === "ai" ? "Writing shots and compiling the spec… about half a minute." : !hasDirection ? "Choose a direction to draft with AI." : ""}</span>
    </div>
  );
}
