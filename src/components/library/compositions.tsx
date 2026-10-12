"use client";

import { Thumbnail } from "@remotion/player";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reuseCompositionAction } from "@/server/actions/journey";
import { SpecComposition } from "@/lib/creative-spec/composition";
import { specDimensions, totalFrames, type CreativeSpecDoc } from "@/lib/creative-spec/schema";

export interface CompositionSummary {
  id: string;
  name: string;
  description: string | null;
  spec: CreativeSpecDoc;
}

/** Saved compositions: preview, then reuse as the start of a new project. */
export function CompositionGrid({ slug, items, canCreate }: { slug: string; items: CompositionSummary[]; canCreate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) {
    return <p className="rounded-lg bg-muted px-6 py-8 text-[15px] text-muted-foreground">No templates yet. Finish a project and choose “Save to library” in its Final stage.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => {
        const { width, height } = specDimensions(c.spec);
        return (
          <div key={c.id} className="flex flex-col overflow-hidden rounded-lg bg-card shadow-card">
            <div className="bg-black">
              <Thumbnail component={SpecComposition} inputProps={{ spec: c.spec }} durationInFrames={totalFrames(c.spec)} fps={c.spec.fps} compositionWidth={width} compositionHeight={height} frameToDisplay={Math.min(totalFrames(c.spec) - 1, 45)} style={{ width: "100%", aspectRatio: `${width} / ${height}`, maxHeight: 360 }} />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="font-medium">{c.name}</p>
              <p className="text-[13px] text-muted-foreground">
                {c.spec.scenes.length} scenes · {(totalFrames(c.spec) / c.spec.fps).toFixed(0)}s · {c.spec.aspect}
              </p>
              {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              {canCreate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-auto"
                  disabled={pending}
                  onClick={() => {
                    setBusy(c.id);
                    startTransition(async () => {
                      const res = await reuseCompositionAction(slug, c.id);
                      setBusy(null);
                      if (!res.ok) return void toast.error(res.message);
                      router.push(`/w/${slug}/projects/${res.data.projectId}?stage=story`);
                    });
                  }}
                >
                  {busy === c.id ? <Loader2 className="animate-spin" /> : <Play />} Use as a starting point
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
