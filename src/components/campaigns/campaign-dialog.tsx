"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { firstErrors, zodFieldErrors } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCampaignAction, updateCampaignAction } from "@/server/actions/projects";
import { campaignSchema } from "@/lib/validation";
import { CampaignFields, emptyCampaign, type CampaignDraft } from "./campaign-fields";

interface CampaignDialogProps {
  slug: string;
  projectId: string;
  /** When set, the dialog edits this campaign instead of creating one. */
  campaign?: CampaignDraft & { id: string };
}

export function NewCampaignDialog(props: Omit<CampaignDialogProps, "campaign">) {
  return <CampaignDialog {...props} />;
}

export function CampaignDialog({ slug, projectId, campaign }: CampaignDialogProps) {
  const router = useRouter();
  const editing = Boolean(campaign);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft>(campaign ?? emptyCampaign);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft(campaign ?? emptyCampaign);
      setErrors({});
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = campaignSchema.safeParse(draft);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues));
    startTransition(async () => {
      const result = campaign
        ? await updateCampaignAction(slug, campaign.id, draft)
        : await createCampaignAction(slug, projectId, draft);
      if (!result.ok) {
        setErrors(firstErrors(result.fieldErrors));
        toast.error(result.message);
        return;
      }
      setOpen(false);
      if (campaign) {
        toast.success("Campaign updated");
        router.refresh();
      } else {
        toast.success("Campaign created");
        const id = (result.data as { id: string }).id;
        router.push(`/w/${slug}/projects/${projectId}/campaigns/${id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline">
            <Pencil data-icon="inline-start" /> Edit brief
          </Button>
        ) : (
          <Button>
            <Plus data-icon="inline-start" /> New campaign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[min(600px,calc(100%-2rem))]">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the brief and deliverables." : "Define the brief and the deliverables you need."}
            </DialogDescription>
          </DialogHeader>
          <CampaignFields value={draft} onChange={setDraft} errors={errors} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
