import "server-only";
import { createDb } from "./client";
import { env } from "@/env";

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

/** Single pooled connection per server process (survives dev hot reloads). */
export const db = (globalForDb.db ??= createDb(env.DATABASE_URL));

export type Db = typeof db;
export * from "./client";
