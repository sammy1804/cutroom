import { z } from "zod";
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/env";
import { AppError, runAction, toActionError } from "@/server/errors";
import { getCapabilityStatuses, resolveCapabilityStatus } from "@/server/providers/registry";
import { initials, relativeTime, shortDate } from "@/lib/format";

describe("env", () => {
  const base = { DATABASE_URL: "postgresql://localhost/x", BETTER_AUTH_SECRET: "x".repeat(32) };

  it("applies defaults and treats empty strings as unset", () => {
    const env = parseServerEnv({ ...base, LLM_PROVIDER: "", STORAGE_PROVIDER: "" });
    expect(env.LLM_PROVIDER).toBe("none");
    expect(env.STORAGE_PROVIDER).toBe("local");
  });

  it("lists every invalid variable", () => {
    expect(() => parseServerEnv({ BETTER_AUTH_SECRET: "short" })).toThrow(/DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });
});

describe("errors", () => {
  it("maps AppError, ZodError and unique violations to safe results", () => {
    expect(toActionError(new AppError("FORBIDDEN", "nope"))).toMatchObject({ ok: false, code: "FORBIDDEN", message: "nope" });
    const zod = z.object({ name: z.string().min(2) }).safeParse({ name: "a" });
    expect(toActionError(zod.error)).toMatchObject({ code: "VALIDATION", fieldErrors: { name: [expect.any(String)] } });
    expect(toActionError({ code: "23505" })).toMatchObject({ code: "CONFLICT" });
  });

  it("hides unexpected error details", async () => {
    const quiet = console.error;
    console.error = () => {};
    const result = await runAction(async () => {
      throw new Error("connection string leaked");
    });
    console.error = quiet;
    expect(result).toEqual({ ok: false, code: "INTERNAL", message: "Something went wrong. Please try again." });
  });
});

describe("provider registry", () => {
  it("reports unconfigured, missing-credential, planned and ready states", () => {
    expect(resolveCapabilityStatus("llm", {}).state).toBe("unconfigured");
    expect(resolveCapabilityStatus("llm", { LLM_PROVIDER: "anthropic" }).state).toBe("missing_credentials");
    expect(resolveCapabilityStatus("llm", { LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }).state).toBe("ready");
    expect(resolveCapabilityStatus("image", { IMAGE_PROVIDER: "openai", OPENAI_API_KEY: "k" }).state).toBe("planned");
    expect(resolveCapabilityStatus("video", { VIDEO_PROVIDER: "local" }).state).toBe("unconfigured");
    expect(resolveCapabilityStatus("storage", { STORAGE_PROVIDER: "local" }).state).toBe("ready");
  });

  it("covers every capability", () => {
    expect(getCapabilityStatuses({}).map((s) => s.capability)).toEqual([
      "llm", "research", "image", "video", "voice", "render", "storage",
    ]);
  });
});

describe("format", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  it("formats relative times and short dates", () => {
    expect(relativeTime(new Date("2026-10-12T11:59:30Z"), now)).toBe("just now");
    expect(relativeTime(new Date("2026-10-12T09:00:00Z"), now)).toBe("3 hours ago");
    expect(shortDate("2026-11-14", now)).toBe("14 Nov");
    expect(shortDate("2027-01-02", now)).toBe("2 Jan 2027");
    expect(initials("Ines Maria Varga")).toBe("IV");
  });
});
