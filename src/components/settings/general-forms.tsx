"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, firstErrors } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { renameWorkspaceAction } from "@/server/actions/workspace";
import { SettingsSection } from "./section";

export function WorkspaceNameForm({ slug, name: initial, canEdit }: { slug: string; name: string; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameWorkspaceAction(slug, { name });
      if (!result.ok) {
        setError(firstErrors(result.fieldErrors).name ?? result.message);
        return;
      }
      setError(undefined);
      toast.success("Workspace renamed");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Workspace name"
        description="Shown in the sidebar and in invitations."
        footer={
          canEdit ? (
            <Button type="submit" size="sm" disabled={pending || name.trim() === initial}>
              {pending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Only owners and admins can rename the workspace.</span>
          )
        }
      >
        <Field id="ws-name" label="Name" error={error} className="max-w-sm">
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={48} className="h-9" />
        </Field>
      </SettingsSection>
    </form>
  );
}

export function DeleteWorkspace({ organizationId, name }: { organizationId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <SettingsSection
      tone="danger"
      title="Delete workspace"
      description="Permanently deletes the workspace, its projects, campaigns and memberships. This cannot be undone."
      footer={
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          Delete workspace
        </Button>
      }
    >
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name}?`}
        description="Everyone loses access immediately and all projects and campaigns are deleted."
        confirmLabel="Delete workspace"
        destructive
        onConfirm={async () => {
          const { error } = await authClient.organization.delete({ organizationId });
          if (error) {
            toast.error(error.message ?? "Couldn't delete the workspace.");
            return false;
          }
          toast.success("Workspace deleted");
          router.replace("/");
          router.refresh();
        }}
      />
    </SettingsSection>
  );
}
