import { z } from "zod";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "NOT_IMPLEMENTED"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL";

/** An error that is safe to show to the user. Anything else is reported as INTERNAL. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const forbidden = (message = "You don't have permission to do that.") =>
  new AppError("FORBIDDEN", message);
export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in to continue.");

/** Discriminated result returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string; fieldErrors?: Record<string, string[]> };

export function toActionError(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof AppError) {
    return { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, code: "VALIDATION", message: "Please fix the highlighted fields.", fieldErrors };
  }
  if (isUniqueViolation(error)) {
    return { ok: false, code: "CONFLICT", message: "That name is already taken." };
  }
  console.error("[action] unexpected error", error);
  return { ok: false, code: "INTERNAL", message: "Something went wrong. Please try again." };
}

function isUniqueViolation(error: unknown): boolean {
  const pgCode = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e ? (e as { code?: unknown }).code : undefined;
  return (
    pgCode(error) === "23505" ||
    (typeof error === "object" && error !== null && "cause" in error && pgCode(error.cause) === "23505")
  );
}

/** Wrap a server action body so it always returns an ActionResult instead of throwing. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    // Let Next.js redirect()/notFound() control-flow errors propagate.
    if (isNextControlFlow(error)) throw error;
    return toActionError(error);
  }
}

function isNextControlFlow(error: unknown): boolean {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : "";
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK");
}
