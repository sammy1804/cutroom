import "server-only";
import { env } from "@/env";
import { db } from "@/server/db";
import { createAuth } from ".";

export const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
});
