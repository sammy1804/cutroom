import type { Database } from "@/server/db/client";
import { forbidden } from "@/server/errors";
import { can, type Permission } from "@/lib/permissions";

/** Everything a workspace-scoped service needs. Built per request by `getWorkspace()`. */
export interface WorkspaceContext {
  db: Database;
  userId: string;
  organization: { id: string; name: string; slug: string; logo: string | null };
  role: string;
}

export function assertCan(ctx: Pick<WorkspaceContext, "role">, permission: Permission) {
  if (!can(ctx.role, permission)) throw forbidden();
}
