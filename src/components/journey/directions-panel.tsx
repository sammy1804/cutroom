"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DirectionCard } from "@/components/brain/direction-card";
import { Button } from "@/components/ui/button";
import { chooseDirectionAction, suggestDirectionsAction } from "@/server/actions/journey";
import type { CreativeDirection } from "@/lib/creative-types";

export function DirectionsPanel({ slug, projectId, directions, chosenId, canEdit, aiEnabled, approvedRefs }: { slug: string; projectId: string; directions: CreativeDirection[]; chosenId: string | null; canEdit: boolean; aiEnabled: boolean; approvedRefs: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const suggest = () => {
    setBusy("suggest");
    startTransition(async () => {
      const res = await suggestDirectionsAction(slug, projectId);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      router.refresh();
    });
  };
  const choose = (id: string) => {
    setBusy(id);
    startTransition(async () => {
      const res = await chooseDirectionAction(slug, projectId, id);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      router.push(`/w/${slug}/projects/${projectId}?stage=story`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant={directions.length ? "outline" : "default"} onClick={suggest} disabled={!aiEnabled || pending}>
            {busy === "suggest" ? <Loader2 className="animate-spin" /> : directions.length ? <RefreshCw data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            {directions.length ? "Suggest three more" : "Suggest directions"}
          </Button>
          <span className="text-[15px] text-muted-foreground">
            {busy === "suggest" ? "Reading the idea, research and references… about half a minute." : `Uses your idea, the research and ${approvedRefs} approved reference${approvedRefs === 1 ? "" : "s"}.`}
          </span>
        </div>
      )}
      {directions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {directions.map((d, i) => (
            <DirectionCard key={d.id} direction={d} index={i} chosen={d.id === chosenId}>
              {canEdit &&
                (d.id === chosenId ? (
                  <span className="flex items-center gap-1.5 text-[15px] font-medium text-tally">
                    <Check className="size-4" /> Chosen
                  </span>
                ) : (
                  <Button onClick={() => choose(d.id)} disabled={pending}>
                    {busy === d.id && <Loader2 className="animate-spin" />}
                    Choose this <ArrowRight data-icon="inline-end" />
                  </Button>
                ))}
            </DirectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
