"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dna, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { JobProgress } from "@/components/jobs/job-progress";
import { Button } from "@/components/ui/button";
import { useJob } from "@/hooks/use-job";
import { approveDirectionAction, buildCreativeDnaAction } from "@/server/actions/creative";

export function DnaActions({ slug, projectId, hasDna, approvedCount, aiEnabled, canEdit }: { slug: string; projectId: string; hasDna: boolean; approvedCount: number; aiEnabled: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string>();
  const [pending, startTransition] = useTransition();
  const job = useJob(slug, jobId);

  if (!canEdit) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={!aiEnabled || pending || approvedCount < 2 || job?.status === "running" || job?.status === "queued"}
          onClick={() =>
            startTransition(async () => {
              const res = await buildCreativeDnaAction(slug, projectId);
              if (!res.ok) return void toast.error(res.message);
              setJobId(res.data.jobId);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Dna data-icon="inline-start" />}
          {hasDna ? "Rebuild from references" : "Build CreativeDNA"}
        </Button>
        {hasDna && (
          <Button
            size="lg"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await approveDirectionAction(slug, projectId);
                if (!res.ok) return void toast.error(res.message);
                toast.success("Direction saved to the company creative library");
                router.refresh();
              })
            }
          >
            <Sparkles data-icon="inline-start" /> Approve direction
          </Button>
        )}
      </div>
      {approvedCount < 2 && <p className="text-sm text-muted-foreground">Approve at least two references to build the DNA ({approvedCount} approved).</p>}
      <JobProgress state={job} label="Reading the approved references and distilling direction…" />
    </div>
  );
}
