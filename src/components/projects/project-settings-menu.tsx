"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { firstErrors, zodFieldErrors } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { archiveProjectAction, deleteProjectAction, updateProjectAction } from "@/server/actions/projects";
import { projectSchema } from "@/lib/validation";
import { ProjectFields, type ProjectDraft } from "./project-fields";

interface Props {
  slug: string;
  project: ProjectDraft & { id: string; status: "active" | "archived" };
  permissions: { update: boolean; archive: boolean; delete: boolean };
}

export function ProjectSettingsMenu({ slug, project, permissions }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(project);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const archived = project.status === "archived";

  if (!permissions.update && !permissions.archive && !permissions.delete) return null;

  function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = projectSchema.safeParse(draft);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues));
    startTransition(async () => {
      const result = await updateProjectAction(slug, project.id, draft);
      if (!result.ok) {
        setErrors(firstErrors(result.fieldErrors));
        toast.error(result.message);
        return;
      }
      toast.success("Project updated");
      setDialog(null);
      router.refresh();
    });
  }

  async function toggleArchive() {
    const result = await archiveProjectAction(slug, project.id, !archived);
    if (!result.ok) return void toast.error(result.message);
    toast.success(archived ? "Project restored" : "Project archived");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Project options">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {permissions.update && (
            <DropdownMenuItem
              onSelect={() => {
                setDraft(project);
                setErrors({});
                setDialog("edit");
              }}
            >
              <Pencil /> Edit details
            </DropdownMenuItem>
          )}
          {permissions.archive && (
            <DropdownMenuItem onSelect={toggleArchive}>
              {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
            </DropdownMenuItem>
          )}
          {permissions.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2 /> Delete project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)}>
        <DialogContent className="sm:max-w-[min(520px,calc(100%-2rem))]">
          <form onSubmit={save} noValidate className="space-y-6">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
            </DialogHeader>
            <ProjectFields value={draft} onChange={setDraft} errors={errors} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Delete ${project.name}?`}
        description="This permanently deletes the project and all of its campaigns. Archive it instead if you might need it again."
        confirmLabel="Delete project"
        destructive
        onConfirm={async () => {
          const result = await deleteProjectAction(slug, project.id);
          if (!result.ok) {
            toast.error(result.message);
            return false;
          }
          toast.success("Project deleted");
          router.push(`/w/${slug}/projects`);
          router.refresh();
        }}
      />
    </>
  );
}
