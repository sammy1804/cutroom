"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/validation";
import { SettingsSection } from "./section";

export function AccountForm({ name: initial, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signUpSchema.shape.name.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    startTransition(async () => {
      const { error } = await authClient.updateUser({ name: parsed.data });
      if (error) return setError(error.message ?? "Couldn't save.");
      setError(undefined);
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Profile"
        description="How you appear to teammates."
        footer={
          <Button type="submit" size="sm" disabled={pending || name.trim() === initial}>
            {pending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        }
      >
        <div className="grid max-w-sm gap-4">
          <Field id="account-name" label="Name" error={error}>
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-9" />
          </Field>
          <Field id="account-email" label="Email">
            <Input id="account-email" value={email} disabled className="h-9" />
          </Field>
        </div>
      </SettingsSection>
    </form>
  );
}
