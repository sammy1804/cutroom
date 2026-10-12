CREATE TYPE "public"."project_stage" AS ENUM('idea', 'explore', 'direction', 'story', 'design', 'motion', 'final');--> statement-breakpoint
CREATE TYPE "public"."skill_run_status" AS ENUM('running', 'succeeded', 'failed', 'cached');--> statement-breakpoint
CREATE TABLE "brain_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "composition" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"description" text,
	"spec" jsonb NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_run" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"user_id" text,
	"skill_id" text NOT NULL,
	"skill_version" text NOT NULL,
	"status" "skill_run_status" DEFAULT 'running' NOT NULL,
	"reason" text,
	"input_hash" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"provider" text,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"parent_run_id" text,
	"workflow_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "stage" "project_stage" DEFAULT 'idea' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "idea" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "format" text DEFAULT '9:16' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "directions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "chosen_direction" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "spec" jsonb;--> statement-breakpoint
ALTER TABLE "brain_thread" ADD CONSTRAINT "brain_thread_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_thread" ADD CONSTRAINT "brain_thread_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_thread" ADD CONSTRAINT "brain_thread_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition" ADD CONSTRAINT "composition_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition" ADD CONSTRAINT "composition_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition" ADD CONSTRAINT "composition_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_run" ADD CONSTRAINT "skill_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_run" ADD CONSTRAINT "skill_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_run" ADD CONSTRAINT "skill_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brain_thread_org_idx" ON "brain_thread" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "composition_org_idx" ON "composition" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "skill_run_org_started_idx" ON "skill_run" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE INDEX "skill_run_cache_idx" ON "skill_run" USING btree ("organization_id","skill_id","input_hash","status");--> statement-breakpoint
UPDATE "member" SET "role" = 'designer' WHERE "role" = 'editor';
--> statement-breakpoint
UPDATE "invitation" SET "role" = 'designer' WHERE "role" = 'editor';
