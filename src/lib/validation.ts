import { z } from "zod";

/** Schemas shared by forms (client) and actions (server). */

export const CHANNELS = [
  { id: "instagram_reels", label: "Instagram Reels" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "meta_ads", label: "Meta Ads" },
] as const;

export const ASPECT_RATIOS = ["9:16", "1:1", "4:5", "16:9"] as const;

export const OBJECTIVES = [
  { id: "awareness", label: "Awareness" },
  { id: "consideration", label: "Consideration" },
  { id: "conversion", label: "Conversion" },
  { id: "launch", label: "Launch" },
  { id: "retention", label: "Retention" },
] as const;

export const CAMPAIGN_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "in_production", label: "In production" },
  { id: "in_review", label: "In review" },
  { id: "approved", label: "Approved" },
  { id: "archived", label: "Archived" },
] as const;

export const PROJECT_COLORS = ["#d4a373", "#e76f51", "#2a9d8f", "#8ab17d", "#6d8bc4", "#b07bac", "#c9c4b6"] as const;

const name = (label: string, max = 80) =>
  z.string().trim().min(2, `${label} must be at least 2 characters.`).max(max, `${label} is too long.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const signUpSchema = z.object({
  name: name("Name", 60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const workspaceSchema = z.object({
  name: name("Workspace name", 48),
});

export const projectSchema = z.object({
  name: name("Project name"),
  description: optionalText(500),
  websiteUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
    .pipe(z.string().url("Enter a valid URL.").optional()),
  color: z.enum(PROJECT_COLORS).default(PROJECT_COLORS[0]),
});

const channelIds = CHANNELS.map((c) => c.id) as [string, ...string[]];
const objectiveIds = OBJECTIVES.map((o) => o.id) as [
  "awareness",
  "consideration",
  "conversion",
  "launch",
  "retention",
];

export const campaignSchema = z.object({
  name: name("Campaign name"),
  objective: z.enum(objectiveIds).default("awareness"),
  brief: optionalText(4000),
  audience: optionalText(500),
  channels: z.array(z.enum(channelIds)).default([]),
  aspectRatios: z.array(z.enum(ASPECT_RATIOS)).default([]),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional()),
});

export const campaignStatusSchema = z.enum(["draft", "in_production", "in_review", "approved", "archived"]);

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["admin", "designer", "marketer", "viewer"]),
});

export type ProjectInput = z.input<typeof projectSchema>;
export type CampaignInput = z.input<typeof campaignSchema>;
