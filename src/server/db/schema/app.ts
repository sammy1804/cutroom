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
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import type { AssetRights, CreativeDNA, CreativeSpec, ReferenceAnalysis } from "@/lib/creative-types";

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

export const assetKind = pgEnum("asset_kind", ["image", "video", "audio", "document", "font", "other"]);
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
]);

export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "canceled"]);

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
export type AnimationPresetRow = typeof animationPreset.$inferSelect;
export type Job = typeof job.$inferSelect;
export type CampaignStatus = (typeof campaignStatus.enumValues)[number];
export type CampaignObjective = (typeof campaignObjective.enumValues)[number];
export type JobKind = (typeof jobKind.enumValues)[number];
export type JobStatus = (typeof jobStatus.enumValues)[number];
