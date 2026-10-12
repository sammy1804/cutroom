"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, firstErrors } from "@/components/field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/permissions";
import { initials, shortDate } from "@/lib/format";
import {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/server/actions/workspace";

export function InviteForm({ slug, allowAdmin }: { slug: string; allowAdmin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const roles = ROLE_ORDER.filter((r) => r !== "owner" && (allowAdmin || r !== "admin"));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await inviteMemberAction(slug, { email, role });
      if (!result.ok) {
        setError(firstErrors(result.fieldErrors).email ?? result.message);
        return;
      }
      setError(undefined);
      setEmail("");
      toast.success(`Invitation sent to ${email}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-start">
      <Field id="invite-email" label="Email" error={error}>
        <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ines@haldencoffee.com" className="h-9" aria-invalid={!!error} />
      </Field>
      <Field id="invite-role" label="Role">
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger id="invite-role" className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_META[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" className="h-9 sm:mt-[22px]" disabled={pending || !email}>
        {pending && <Loader2 className="animate-spin" />}
        Send invite
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-3">{ROLE_META[role].description}</p>
    </form>
  );
}

interface MemberRowProps {
  slug: string;
  member: { id: string; name: string; email: string; image: string | null; role: Role; joinedAt: Date };
  isSelf: boolean;
  canManage: boolean;
  canAssignOwner: boolean;
}

export function MemberRow({ slug, member, isSelf, canManage, canAssignOwner }: MemberRowProps) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const roles = ROLE_ORDER.filter((r) => r !== "owner" || canAssignOwner);

  function changeRole(next: string) {
    const previous = role;
    setRole(next as Role);
    startTransition(async () => {
      const result = await updateMemberRoleAction(slug, member.id, next);
      if (!result.ok) {
        setRole(previous);
        toast.error(result.message);
        return;
      }
      toast.success(`${member.name} is now ${ROLE_META[next as Role].label.toLowerCase()}`);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar className="size-8">
        {member.image && <AvatarImage src={member.image} alt="" />}
        <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name} {isSelf && <span className="font-normal text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {member.email} · joined {shortDate(member.joinedAt)}
        </p>
      </div>
      {canManage ? (
        <div className="flex items-center gap-1">
          <Select value={role} onValueChange={changeRole} disabled={pending}>
            <SelectTrigger className="h-8 w-[120px]" aria-label={`Role for ${member.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_META[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name}`} onClick={() => setConfirm(true)}>
            <UserMinus />
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={`Remove ${member.name}?`}
            description="They'll lose access to every project in this workspace. You can invite them again later."
            confirmLabel="Remove"
            destructive
            onConfirm={async () => {
              const result = await removeMemberAction(slug, member.id);
              if (!result.ok) {
                toast.error(result.message);
                return false;
              }
              toast.success(`${member.name} removed`);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{ROLE_META[member.role].label}</span>
      )}
    </li>
  );
}

export function PendingInvitationRow({
  slug,
  invitation,
  link,
}: {
  slug: string;
  invitation: { id: string; email: string; role: string | null; expiresAt: Date };
  link: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const role = (invitation.role ?? "viewer") as Role;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground">
        {initials(invitation.email)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_META[role]?.label ?? role} · expires {shortDate(invitation.expiresAt)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast.success("Invite link copied");
          } catch {
            toast.error("Couldn't copy. The link is in the server log.");
          }
        }}
      >
        <Copy data-icon="inline-start" /> Copy link
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Cancel invitation for ${invitation.email}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelInvitationAction(slug, invitation.id);
            if (!result.ok) return void toast.error(result.message);
            toast.success("Invitation cancelled");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <X />}
      </Button>
    </li>
  );
}
