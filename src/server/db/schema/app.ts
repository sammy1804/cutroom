import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  date,
  boolean,
  doublePrecision,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import type { AssetRights, BrainTurn, CreativeDirection, CreativeDNA, CreativeSpec, ReferenceAnalysis } from "@/lib/creative-types";
import type { CreativeSpecDoc } from "@/lib/creative-spec/schema";
import type { BoardDoc, BoardOp } from "@/lib/board";

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

const orgRef = () =>
  text()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const creatorRef = () => text().references(() => user.id, { onDelete: "set null" });

// ─── Enums ──────────────────────────────────────────────────────────────────

export const projectStatus = pgEnum("project_status", ["active", "archived"]);

export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "in_production",
  "in_review",
  "approved",
  "archived",
]);

export const campaignObjective = pgEnum("campaign_objective", [
  "awareness",
  "consideration",
  "conversion",
  "launch",
  "retention",
]);

export const assetKind = pgEnum("asset_kind", ["image", "video", "audio", "animation", "document", "font", "other"]);
export const assetSource = pgEnum("asset_source", ["upload", "generated", "imported", "render", "sourced"]);
/** Lifecycle of a usable asset. Sourced items start as candidates and need explicit approval. */
export const assetUsageStatus = pgEnum("asset_usage_status", ["candidate", "approved", "in_use", "rejected"]);

export const sourceType = pgEnum("source_type", [
  "DESIGN_REFERENCE",
  "MOTION_REFERENCE",
  "PHOTOGRAPHY",
  "VIDEO",
  "ILLUSTRATION",
  "TYPOGRAPHY",
  "3D",
  "TEXTURE",
  "ICON",
  "AUDIO",
]);
/** What a source may be used for. Reference-only sources never produce production assets. */
export const sourceRole = pgEnum("source_role", ["reference", "asset"]);
export const sourceAccess = pgEnum("source_access", ["browser", "api", "manual"]);
export const rightsPolicy = pgEnum("rights_policy", ["reference_only", "per_item_license", "platform_license"]);
export const referenceStatus = pgEnum("reference_status", ["pending", "approved", "rejected"]);
export const memoryKind = pgEnum("memory_kind", [
  "animation",
  "reference",
  "asset",
  "campaign",
  "composition",
  "transition",
  "direction",
]);

/** Every long-running, provider-backed operation (Phase 2+) is a job. */
export const jobKind = pgEnum("job_kind", [
  "research",
  "reference_capture",
  "asset_search",
  "creative_dna",
  "script",
  "image_generation",
  "video_generation",
  "voice_generation",
  "render",
  "library_harvest",
]);

export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "canceled"]);

/** Where a project is in its journey. One project, one state; not separate apps. */
export const projectStage = pgEnum("project_stage", ["idea", "explore", "direction", "story", "design", "motion", "final"]);
/** Kinds of item in the shared open library (harvested from licence-clear sources). */
export const libraryKind = pgEnum("library_kind", ["lottie", "texture", "hdri"]);

export const skillRunStatus = pgEnum("skill_run_status", ["running", "succeeded", "failed", "cached"]);

// ─── Tables ─────────────────────────────────────────────────────────────────

/** A brand, product or client the team makes content for. Owns campaigns and assets. */
export const project = pgTable(
  "project",
  {
    id: id(),
    organizationId: orgRef(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    websiteUrl: text(),
    /** Swatch used to identify the project across the UI. */
    color: text().notNull().default("#d4a373"),
    status: projectStatus().notNull().default("active"),
    stage: projectStage().notNull().default("idea"),
    /** IDEA: what the piece is trying to say. */
    idea: text(),
    audience: text(),
    /** Primary output format, e.g. "9:16". */
    format: text().notNull().default("9:16"),
    /** DIRECTION: options offered and the one chosen. */
    directions: jsonb().$type<CreativeDirection[]>().notNull().default([]),
    chosenDirection: jsonb().$type<CreativeDirection | null>(),
    /** STORY → FINAL: the source of truth for preview and render. */
    spec: jsonb().$type<CreativeSpecDoc | null>(),
    /** The project board: a free canvas of notes, media, presets and palettes around the piece. */
    board: jsonb().$type<BoardDoc | null>(),
    /** Increments with every applied board operation; clients sync from it. */
    boardVersion: integer().notNull().default(0),
    createdById: creatorRef(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("project_org_slug_uidx").on(t.organizationId, t.slug),
    index("project_org_status_idx").on(t.organizationId, t.status),
  ],
);

/** A deliverable push inside a project: a brief, channels and formats, later scripts and renders. */
export const campaign = pgTable(
  "campaign",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text().notNull(),
    objective: campaignObjective().notNull().default("awareness"),
    status: campaignStatus().notNull().default("draft"),
    brief: text(),
    audience: text(),
    channels: text().array().notNull().default(sql`'{}'::text[]`),
    aspectRatios: text().array().notNull().default(sql`'{}'::text[]`),
    dueDate: date({ mode: "string" }),
    /** What the editor will consume: chosen animations, assets and direction. See lib/creative-spec. */
    creativeSpec: jsonb().$type<CreativeSpec>().notNull().default({ animations: [], assets: [] }),
    createdById: creatorRef(),
    ...timestamps,
  },
  (t) => [
    index("campaign_project_idx").on(t.projectId),
    index("campaign_org_status_idx").on(t.organizationId, t.status),
  ],
);

/** Any usable media: uploads, sourced free assets, generated output and renders. Never references. */
export const asset = pgTable(
  "asset",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text().references(() => project.id, { onDelete: "cascade" }),
    campaignId: text().references(() => campaign.id, { onDelete: "set null" }),
    kind: assetKind().notNull(),
    source: assetSource().notNull().default("upload"),
    usageStatus: assetUsageStatus().notNull().default("candidate"),
    name: text().notNull(),
    /** Set when the file is stored by us; sourced assets may only point at the provider. */
    storageProvider: text(),
    storageKey: text(),
    externalUrl: text(),
    thumbnailUrl: text(),
    mimeType: text(),
    sizeBytes: integer().notNull().default(0),
    width: integer(),
    height: integer(),
    durationMs: integer(),
    /** Licensing record. Required for anything sourced from a third party. */
    rights: jsonb().$type<AssetRights>(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    /** The job that produced or found this asset. */
    jobId: text(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdById: creatorRef(),
    ...timestamps,
  },
  (t) => [
    index("asset_org_status_idx").on(t.organizationId, t.usageStatus),
    index("asset_project_idx").on(t.projectId),
    index("asset_campaign_idx").on(t.campaignId),
  ],
);

/** An approved place to look for references or assets. Seeded per workspace from lib/sources. */
export const source = pgTable(
  "source",
  {
    id: id(),
    organizationId: orgRef(),
    key: text().notNull(),
    name: text().notNull(),
    url: text().notNull(),
    type: sourceType().notNull(),
    role: sourceRole().notNull(),
    enabled: boolean().notNull().default(true),
    purpose: text().notNull(),
    accessMethod: sourceAccess().notNull(),
    rightsPolicy: rightsPolicy().notNull(),
    /** Adapter id for API-backed asset sources (openverse, wikimedia, pexels, pixabay). */
    apiProvider: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex("source_org_key_uidx").on(t.organizationId, t.key)],
);

/** Visual research. Used to learn direction from, never placed in a final creative. */
export const reference = pgTable(
  "reference",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text().references(() => project.id, { onDelete: "cascade" }),
    campaignId: text().references(() => campaign.id, { onDelete: "set null" }),
    sourceId: text().references(() => source.id, { onDelete: "set null" }),
    /** Section crops point at the full-page capture they came from. */
    parentId: text(),
    url: text().notNull(),
    title: text().notNull(),
    imageKey: text(),
    width: integer(),
    height: integer(),
    analysis: jsonb().$type<ReferenceAnalysis>(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    /** 0–100 relevance to the brief it was collected for. */
    rank: integer().notNull().default(0),
    status: referenceStatus().notNull().default("pending"),
    jobId: text(),
    createdById: creatorRef(),
    ...timestamps,
  },
  (t) => [
    index("reference_project_idx").on(t.projectId, t.status),
    index("reference_org_idx").on(t.organizationId),
  ],
);

/** What a project's approved references taught us, distilled into direction. */
export const creativeDna = pgTable("creative_dna", {
  projectId: text()
    .primaryKey()
    .references(() => project.id, { onDelete: "cascade" }),
  organizationId: orgRef(),
  dna: jsonb().$type<CreativeDNA>().notNull(),
  referenceIds: text().array().notNull().default(sql`'{}'::text[]`),
  ...timestamps,
});

/** A workspace's saved variation of a built-in animation preset. */
export const animationPreset = pgTable(
  "animation_preset",
  {
    id: id(),
    organizationId: orgRef(),
    basePresetId: text().notNull(),
    name: text().notNull(),
    description: text(),
    params: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdById: creatorRef(),
    ...timestamps,
  },
  (t) => [index("animation_preset_org_idx").on(t.organizationId)],
);

/** Company Creative Library: approved creative decisions that teach the system how this company designs. */
export const creativeMemory = pgTable(
  "creative_memory",
  {
    id: id(),
    organizationId: orgRef(),
    kind: memoryKind().notNull(),
    /** Id of the thing approved (preset id, reference id, asset id, campaign id…). */
    subjectId: text().notNull(),
    title: text().notNull(),
    note: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    approvedById: creatorRef(),
    ...timestamps,
  },
  (t) => [uniqueIndex("creative_memory_subject_uidx").on(t.organizationId, t.kind, t.subjectId)],
);

/** Queue record for provider-backed work: research, generation and rendering. */
export const job = pgTable(
  "job",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text().references(() => project.id, { onDelete: "cascade" }),
    campaignId: text().references(() => campaign.id, { onDelete: "cascade" }),
    kind: jobKind().notNull(),
    status: jobStatus().notNull().default("queued"),
    provider: text().notNull(),
    input: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    output: jsonb().$type<Record<string, unknown>>(),
    error: text(),
    /** 0–100 */
    progress: integer().notNull().default(0),
    attempts: integer().notNull().default(0),
    createdById: creatorRef(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("job_status_idx").on(t.status, t.createdAt),
    index("job_campaign_idx").on(t.campaignId),
  ],
);

/** Observability: one row per skill execution (or cache hit). */
export const skillRun = pgTable(
  "skill_run",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text().references(() => project.id, { onDelete: "set null" }),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    skillId: text().notNull(),
    skillVersion: text().notNull(),
    status: skillRunStatus().notNull().default("running"),
    /** Why it ran, in plain language, e.g. "Draft storyboard for 'Second Life'". */
    reason: text(),
    inputHash: text().notNull(),
    input: jsonb().$type<unknown>(),
    output: jsonb().$type<unknown>(),
    error: text(),
    provider: text(),
    model: text(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    /** Estimated USD, micro-dollar precision. */
    costUsd: doublePrecision().notNull().default(0),
    durationMs: integer().notNull().default(0),
    attempts: integer().notNull().default(1),
    parentRunId: text(),
    workflowId: text(),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("skill_run_org_started_idx").on(t.organizationId, t.startedAt),
    index("skill_run_cache_idx").on(t.organizationId, t.skillId, t.inputHash, t.status),
  ],
);

/**
 * Open library: a shared catalog harvested from sources with clear licences and
 * official access (Poly Haven API, Google's Noto animated emoji). Searched
 * without AI. Not tenant data: every workspace sees the same catalog; using an
 * item copies it into the workspace's own assets with its rights record.
 */
export const libraryItem = pgTable(
  "library_item",
  {
    id: id(),
    source: text().notNull(),
    externalId: text().notNull(),
    kind: libraryKind().notNull(),
    name: text().notNull(),
    description: text(),
    category: text(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    /** Lightweight preview (webp/png) safe to show in grids. */
    thumbnailUrl: text(),
    /** Animated preview for Lottie (animated webp/gif). */
    previewUrl: text(),
    /** Source files by role, e.g. { lottie: url } or { diffuse_1k: url, hdr_1k: url }. */
    files: jsonb().$type<Record<string, { url: string; size?: number }>>().notNull().default({}),
    rights: jsonb().$type<AssetRights & { credit: string }>().notNull(),
    /** Deterministic features for search and ranking (popularity, dimensions, attributes…). */
    features: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** Source-side version/hash, so re-harvests only touch changed items. */
    sourceVersion: text(),
    active: boolean().notNull().default(true),
    harvestedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("library_item_source_uidx").on(t.source, t.externalId),
    index("library_item_kind_idx").on(t.kind, t.active),
  ],
);

/** Brain: a brainstorming conversation that can become a project. */
export const brainThread = pgTable(
  "brain_thread",
  {
    id: id(),
    organizationId: orgRef(),
    title: text().notNull(),
    turns: jsonb().$type<BrainTurn[]>().notNull().default([]),
    projectId: text().references(() => project.id, { onDelete: "set null" }),
    createdById: creatorRef(),
    ...timestamps,
  },
  (t) => [index("brain_thread_org_idx").on(t.organizationId, t.updatedAt)],
);

/** A saved, reusable composition (a CreativeSpec snapshot) in the library. */
export const composition = pgTable(
  "composition",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text().references(() => project.id, { onDelete: "set null" }),
    name: text().notNull(),
    description: text(),
    spec: jsonb().$type<CreativeSpecDoc>().notNull(),
    createdById: creatorRef(),
    ...timestamps,
  },
  (t) => [index("composition_org_idx").on(t.organizationId, t.createdAt)],
);

// ─── Relations ──────────────────────────────────────────────────────────────

export const projectRelations = relations(project, ({ one, many }) => ({
  organization: one(organization, { fields: [project.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [project.createdById], references: [user.id] }),
  campaigns: many(campaign),
  assets: many(asset),
}));

export const campaignRelations = relations(campaign, ({ one, many }) => ({
  project: one(project, { fields: [campaign.projectId], references: [project.id] }),
  createdBy: one(user, { fields: [campaign.createdById], references: [user.id] }),
  assets: many(asset),
  jobs: many(job),
}));

/** Board operation log: what live collaborators poll to catch up. Pruned after a day. */
export const boardOp = pgTable(
  "board_op",
  {
    id: id(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    clientId: text().notNull(),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    ops: jsonb().$type<BoardOp[]>().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("board_op_project_version_uidx").on(t.projectId, t.version)],
);

/** Who is on a board right now: cursor and selection, refreshed every second or so. */
export const boardPresence = pgTable(
  "board_presence",
  {
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    clientId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull(),
    cursor: jsonb().$type<{ x: number; y: number } | null>(),
    selection: text(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.clientId] })],
);

/** Comment threads pinned to a spot on the board or to a frame. Replies point at their thread. */
export const boardComment = pgTable(
  "board_comment",
  {
    id: id(),
    organizationId: orgRef(),
    projectId: text()
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    threadId: text(),
    frameId: text(),
    x: doublePrecision().notNull().default(0),
    y: doublePrecision().notNull().default(0),
    body: text().notNull(),
    authorId: creatorRef(),
    resolvedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("board_comment_project_idx").on(t.projectId, t.updatedAt)],
);

export const referenceRelations = relations(reference, ({ one }) => ({
  project: one(project, { fields: [reference.projectId], references: [project.id] }),
  source: one(source, { fields: [reference.sourceId], references: [source.id] }),
}));

export const assetRelations = relations(asset, ({ one }) => ({
  project: one(project, { fields: [asset.projectId], references: [project.id] }),
  campaign: one(campaign, { fields: [asset.campaignId], references: [campaign.id] }),
}));

export const jobRelations = relations(job, ({ one }) => ({
  campaign: one(campaign, { fields: [job.campaignId], references: [campaign.id] }),
}));

export type Project = typeof project.$inferSelect;
export type Campaign = typeof campaign.$inferSelect;
export type Asset = typeof asset.$inferSelect;
export type Source = typeof source.$inferSelect;
export type Reference = typeof reference.$inferSelect;
export type CreativeMemory = typeof creativeMemory.$inferSelect;
export type SkillRun = typeof skillRun.$inferSelect;
export type LibraryItem = typeof libraryItem.$inferSelect;
export type BrainThread = typeof brainThread.$inferSelect;
export type Composition = typeof composition.$inferSelect;
export type AnimationPresetRow = typeof animationPreset.$inferSelect;
export type Job = typeof job.$inferSelect;
export type BoardComment = typeof boardComment.$inferSelect;
export type CampaignStatus = (typeof campaignStatus.enumValues)[number];
export type CampaignObjective = (typeof campaignObjective.enumValues)[number];
export type JobKind = (typeof jobKind.enumValues)[number];
export type JobStatus = (typeof jobStatus.enumValues)[number];
