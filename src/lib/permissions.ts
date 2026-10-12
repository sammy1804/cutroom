import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Workspace roles and what they can do.
 *
 * Better Auth enforces the organization/member/invitation statements on its own
 * endpoints; the app enforces project/campaign/asset/job statements in services.
 * Both read from the same access-control definition.
 */
export const statements = {
  ...defaultStatements,
  project: ["create", "update", "archive", "delete"],
  campaign: ["create", "update", "archive", "delete"],
  asset: ["upload", "delete"],
  job: ["create", "cancel"],
  providers: ["manage"],
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["create", "read", "update", "delete"],
    project: ["create", "update", "archive", "delete"],
    campaign: ["create", "update", "archive", "delete"],
    asset: ["upload", "delete"],
    job: ["create", "cancel"],
    providers: ["manage"],
  }),
  admin: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["read"],
    project: ["create", "update", "archive", "delete"],
    campaign: ["create", "update", "archive", "delete"],
    asset: ["upload", "delete"],
    job: ["create", "cancel"],
    providers: ["manage"],
  }),
  /** Makes the work: projects, direction, story, design and motion. */
  designer: ac.newRole({
    project: ["create", "update", "archive"],
    campaign: ["create", "update", "archive"],
    asset: ["upload", "delete"],
    job: ["create", "cancel"],
  }),
  /** Runs research and campaigns; same creative rights as a designer. */
  marketer: ac.newRole({
    project: ["create", "update", "archive"],
    campaign: ["create", "update", "archive"],
    asset: ["upload", "delete"],
    job: ["create", "cancel"],
  }),
  /** Legacy name for designer, kept so existing memberships keep working. */
  editor: ac.newRole({
    project: ["create", "update", "archive"],
    campaign: ["create", "update", "archive"],
    asset: ["upload", "delete"],
    job: ["create", "cancel"],
  }),
  viewer: ac.newRole({}),
};

export type Role = keyof typeof roles;
export const ROLE_ORDER: Role[] = ["owner", "admin", "designer", "marketer", "viewer"];

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full control, including billing and deleting the workspace." },
  admin: { label: "Admin", description: "Manage members, providers and all projects." },
  designer: { label: "Designer", description: "Create projects and shape direction, story, design and motion." },
  marketer: { label: "Marketer", description: "Run research and campaigns, and create projects." },
  editor: { label: "Designer", description: "Create projects and shape direction, story, design and motion." },
  viewer: { label: "Viewer", description: "Read-only access to projects and campaigns." },
};

type Statements = typeof statements;
export type Permission = {
  [K in keyof Statements]?: Statements[K][number][];
};

export function isRole(value: string): value is Role {
  return value in roles;
}

/** Members can hold several comma-separated roles (Better Auth convention). */
export function parseRoles(value: string): Role[] {
  return value
    .split(",")
    .map((r) => r.trim())
    .filter(isRole);
}

export function can(roleValue: string, permission: Permission): boolean {
  return parseRoles(roleValue).some(
    (role) => roles[role].authorize(permission as never).success,
  );
}

/** The highest-ranked role, for display. */
export function primaryRole(roleValue: string): Role {
  const held = parseRoles(roleValue);
  if (held.includes("editor") && !held.some((r) => r === "owner" || r === "admin")) return "designer";
  return ROLE_ORDER.find((r) => held.includes(r)) ?? "viewer";
}
