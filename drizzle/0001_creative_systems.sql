CREATE TYPE "public"."asset_usage_status" AS ENUM('candidate', 'approved', 'in_use', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('animation', 'reference', 'asset', 'campaign', 'composition', 'transition', 'direction');--> statement-breakpoint
CREATE TYPE "public"."reference_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rights_policy" AS ENUM('reference_only', 'per_item_license', 'platform_license');--> statement-breakpoint
CREATE TYPE "public"."source_access" AS ENUM('browser', 'api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."source_role" AS ENUM('reference', 'asset');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('DESIGN_REFERENCE', 'MOTION_REFERENCE', 'PHOTOGRAPHY', 'VIDEO', 'ILLUSTRATION', 'TYPOGRAPHY', '3D', 'TEXTURE', 'ICON', 'AUDIO');--> statement-breakpoint
ALTER TYPE "public"."asset_source" ADD VALUE 'sourced';--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'reference_capture' BEFORE 'script';--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'asset_search' BEFORE 'script';--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'creative_dna' BEFORE 'script';--> statement-breakpoint
CREATE TABLE "animation_preset" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"base_preset_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_dna" (
	"project_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"dna" jsonb NOT NULL,
	"reference_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approved_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"campaign_id" text,
	"source_id" text,
	"parent_id" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"image_key" text,
	"width" integer,
	"height" integer,
	"analysis" jsonb,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"status" "reference_status" DEFAULT 'pending' NOT NULL,
	"job_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"type" "source_type" NOT NULL,
	"role" "source_role" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"purpose" text NOT NULL,
	"access_method" "source_access" NOT NULL,
	"rights_policy" "rights_policy" NOT NULL,
	"api_provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "storage_provider" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "mime_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "usage_status" "asset_usage_status" DEFAULT 'candidate' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "rights" jsonb;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "creative_spec" jsonb DEFAULT '{"animations":[],"assets":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "animation_preset" ADD CONSTRAINT "animation_preset_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animation_preset" ADD CONSTRAINT "animation_preset_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_dna" ADD CONSTRAINT "creative_dna_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_dna" ADD CONSTRAINT "creative_dna_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_memory" ADD CONSTRAINT "creative_memory_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_memory" ADD CONSTRAINT "creative_memory_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animation_preset_org_idx" ON "animation_preset" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creative_memory_subject_uidx" ON "creative_memory" USING btree ("organization_id","kind","subject_id");--> statement-breakpoint
CREATE INDEX "reference_project_idx" ON "reference" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "reference_org_idx" ON "reference" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_org_key_uidx" ON "source" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "asset_org_status_idx" ON "asset" USING btree ("organization_id","usage_status");