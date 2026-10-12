"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/server/actions/workspace";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptInvitationAction(invitationId);
          if (!result.ok) return void toast.error(result.message);
          router.replace(result.data.slug ? `/w/${result.data.slug}` : "/");
          router.refresh();
        })
      }
    >
      {pending && <Loader2 className="animate-spin" />}
      Accept invitation
    </Button>
  );
}
