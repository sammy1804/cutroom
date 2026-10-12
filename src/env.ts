import { z } from "zod";

/**
 * Server-side environment, validated once at boot.
 * Import `env` only from server code — it is never sent to the client.
 */

const providerId = z.string().trim().min(1).default("none");

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  EMAIL_PROVIDER: z.enum(["console"]).default("console"),
  EMAIL_FROM: z.string().default("Cutroom <studio@example.com>"),

  LLM_PROVIDER: providerId,
  RESEARCH_PROVIDER: providerId,
  IMAGE_PROVIDER: providerId,
  VIDEO_PROVIDER: providerId,
  VOICE_PROVIDER: providerId,
  RENDER_PROVIDER: providerId,
  STORAGE_PROVIDER: z.string().trim().min(1).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.storage"),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/** On Vercel, fall back to the deployment's own URL and to Blob storage. */
function vercelDefaults(source: Record<string, string | undefined>) {
  if (!source.VERCEL) return {};
  const host = source.VERCEL_ENV === "production" ? (source.VERCEL_PROJECT_PRODUCTION_URL ?? source.VERCEL_URL) : source.VERCEL_URL;
  return {
    ...(host ? { BETTER_AUTH_URL: `https://${host}` } : {}),
    ...(source.BLOB_READ_WRITE_TOKEN ? { STORAGE_PROVIDER: "vercel-blob" } : {}),
  };
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // Treat empty strings as unset so `.env` placeholders fall back to defaults.
  const cleaned = {
    ...vercelDefaults(source),
    ...Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== "")),
  };
  const result = serverSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lazily parsed so that `next build` and tooling can import modules without a full env. */
export const env = new Proxy({} as ServerEnv, {
  get(_target, key: string) {
    cached ??= parseServerEnv(process.env);
    return cached[key as keyof ServerEnv];
  },
});

export const publicEnv = {
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Cutroom",
};
