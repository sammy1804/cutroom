"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AnimationPreview } from "@/components/library/animation-preview";
import { Button } from "@/components/ui/button";
import { removeSpecAnimationAction } from "@/server/actions/creative";
import type { SpecAnimation } from "@/lib/creative-types";
import { setDragItem } from "@/lib/drag";

const ROLE_LABEL: Record<string, string> = { headline: "Headline", body: "Body text", image: "Images", object: "Objects", transition: "Transitions", background: "Background" };

/** The campaign's creative spec: the motion system the editor will build from. */
export function CreativeSpecPanel({ slug, campaignId, animations, canEdit }: { slug: string; campaignId: string; animations: SpecAnimation[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (animations.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
        <p className="text-[15px] text-muted-foreground">No motion chosen yet. Pick animations for headlines, images, transitions and backgrounds; the editor will start from this spec.</p>
        <Button asChild variant="outline">
          <Link href={`/w/${slug}/library?tab=animations`}>
            <Wand2 data-icon="inline-start" /> Browse animations
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {animations.map((a) => (
        <div key={a.id} draggable onDragStart={(e) => setDragItem(e, { type: "animation", presetId: a.presetId, params: a.params, name: a.name, customPresetId: a.customPresetId })} className="overflow-hidden rounded-lg bg-card shadow-card">
          <AnimationPreview layers={[{ presetId: a.presetId, params: a.params }]} />
          <div className="flex items-center justify-between gap-2 p-4">
            <div className="min-w-0">
              <p className="label-meta">{ROLE_LABEL[a.role] ?? a.role}</p>
              <p className="truncate font-medium">{a.name}</p>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${a.name}`}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removeSpecAnimationAction(slug, campaignId, a.id);
                    if (!res.ok) return void toast.error(res.message);
                    router.refresh();
                  })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
