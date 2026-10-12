"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, zodFieldErrors } from "@/components/field";
import { authClient } from "@/lib/auth-client";
import { signInSchema, signUpSchema } from "@/lib/validation";

type Mode = "sign-in" | "sign-up";

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; alt: React.ReactNode }> = {
  "sign-in": {
    title: "Sign in",
    subtitle: "Welcome back. Pick up where your team left off.",
    cta: "Sign in",
    alt: (
      <>
        New to Cutroom?{" "}
        <Link href="/sign-up" className="text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </>
    ),
  },
  "sign-up": {
    title: "Create your account",
    subtitle: "You'll set up a workspace for your team next.",
    cta: "Create account",
    alt: (
      <>
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </>
    ),
  },
};

/** Only allow same-site relative redirects. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const copy = COPY[mode];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const parsed = (mode === "sign-up" ? signUpSchema : signInSchema).safeParse(raw);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const { error } =
        mode === "sign-up"
          ? await authClient.signUp.email(parsed.data as { name: string; email: string; password: string })
          : await authClient.signIn.email(parsed.data);
      if (error) {
        setFormError(
          error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "That email and password don't match."
            : (error.message ?? "Something went wrong. Please try again."),
        );
        return;
      }
      const next = params.get("next");
      router.replace(next ? safeNext(next) : mode === "sign-up" ? "/onboarding" : "/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {mode === "sign-up" && (
          <Field id="name" label="Full name" error={errors.name}>
            <Input id="name" name="name" autoComplete="name" aria-invalid={!!errors.name} className="h-9" autoFocus />
          </Field>
        )}
        <Field id="email" label="Work email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            className="h-9"
            autoFocus={mode === "sign-in"}
          />
        </Field>
        <Field
          id="password"
          label="Password"
          error={errors.password}
          hint={mode === "sign-up" ? "At least 8 characters." : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            aria-invalid={!!errors.password}
            className="h-9"
          />
        </Field>

        {formError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {copy.cta}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{copy.alt}</p>
    </div>
  );
}
