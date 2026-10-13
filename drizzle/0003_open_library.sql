CREATE TYPE "public"."library_kind" AS ENUM('lottie', 'texture', 'hdri');--> statement-breakpoint
ALTER TYPE "public"."asset_kind" ADD VALUE 'animation' BEFORE 'document';--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'library_harvest';--> statement-breakpoint
CREATE TABLE "library_item" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"kind" "library_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"thumbnail_url" text,
	"preview_url" text,
	"files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rights" jsonb NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_version" text,
	"active" boolean DEFAULT true NOT NULL,
	"harvested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "library_item_source_uidx" ON "library_item" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "library_item_kind_idx" ON "library_item" USING btree ("kind","active");