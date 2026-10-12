"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteCampaignAction, setCampaignStatusAction } from "@/server/actions/projects";
import type { CampaignStatus } from "@/server/db/schema/app";
import { CAMPAIGN_STATUSES } from "@/lib/validation";

interface Props {
  slug: string;
  projectId: string;
  campaignId: string;
  status: CampaignStatus;
  permissions: { update: boolean; archive: boolean; delete: boolean };
}

export function CampaignActions({ slug, projectId, campaignId, status, permissions }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const statuses = CAMPAIGN_STATUSES.filter((s) => (s.id === "archived" ? permissions.archive : true));

  function changeStatus(next: string) {
    const previous = value;
    setValue(next as CampaignStatus);
    startTransition(async () => {
      const result = await setCampaignStatusAction(slug, campaignId, next);
      if (!result.ok) {
        setValue(previous);
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Select value={value} onValueChange={changeStatus} disabled={!permissions.update || pending}>
        <SelectTrigger className="h-8 w-[160px]" aria-label="Campaign status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <StatusDot status={s.id} /> {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {permissions.delete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Campaign options">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete campaign
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this campaign?"
        description="The brief and deliverables will be permanently deleted. Set the status to Archived instead to keep a record."
        confirmLabel="Delete campaign"
        destructive
        onConfirm={async () => {
          const result = await deleteCampaignAction(slug, campaignId);
          if (!result.ok) {
            toast.error(result.message);
            return false;
          }
          toast.success("Campaign deleted");
          router.push(`/w/${slug}/projects/${projectId}`);
          router.refresh();
        }}
      />
    </>
  );
}
