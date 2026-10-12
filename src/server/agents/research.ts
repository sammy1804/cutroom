import "server-only";
import { z } from "zod";
import { structured, webResearch } from "@/server/ai/claude";
import type { Campaign, Project } from "@/server/db/schema";
import { CHANNELS, OBJECTIVES } from "@/lib/validation";

/** Research Brain: web research for a campaign, distilled into decisions the creative team can use. */

export const researchReportSchema = z.object({
  summary: z.string().describe("3–5 sentence executive summary of what matters for this campaign"),
  audience: z.array(z.object({ insight: z.string(), implication: z.string() })).describe("What the audience believes, wants or does, and what that means for the creative"),
  competitors: z.array(z.object({ name: z.string(), url: z.string(), approach: z.string(), opening: z.string() })),
  trends: z.array(z.object({ trend: z.string(), evidence: z.string() })),
  hooks: z.array(z.string()).describe("Opening lines or visual hooks for short-form video, specific to this brand"),
  visualDirections: z.array(z.string()).describe("Concrete art-direction ideas grounded in the research"),
  referenceLeads: z.array(z.object({ url: z.string(), why: z.string() })).describe("Public pages worth capturing as visual references (brand sites, competitor sites, campaign pages)"),
  sources: z.array(z.object({ url: z.string(), title: z.string() })),
});

export type ResearchReport = z.infer<typeof researchReportSchema>;

export async function runCampaignResearch(
  project: Pick<Project, "name" | "description" | "websiteUrl">,
  campaign: Pick<Campaign, "name" | "objective" | "brief" | "audience" | "channels" | "aspectRatios">,
  focus: string | undefined,
  report: (progress: number) => Promise<void>,
): Promise<ResearchReport> {
  const channels = campaign.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(", ") || "not chosen yet";
  const brief = [
    `Brand / product: ${project.name}${project.websiteUrl ? ` (${project.websiteUrl})` : ""}`,
    project.description && `About: ${project.description}`,
    `Campaign: ${campaign.name}`,
    `Objective: ${OBJECTIVES.find((o) => o.id === campaign.objective)?.label}`,
    campaign.brief && `Brief: ${campaign.brief}`,
    campaign.audience && `Audience: ${campaign.audience}`,
    `Channels: ${channels}; formats: ${campaign.aspectRatios.join(", ") || "any"}`,
    focus && `Specific question from the team: ${focus}`,
  ]
    .filter(Boolean)
    .join("\n");

  await report(10);
  const findings = await webResearch({
    system:
      "You are the research lead at a video-first creative studio. You research brands, audiences, competitors and " +
      "platform trends so the creative team can make better short-form marketing videos. Prefer primary sources and " +
      "recent material. Be specific and cite where each finding came from. Distinguish evidence from your inference.",
    prompt:
      `Research this campaign and write up what you find.\n\n${brief}\n\n` +
      "Cover: the audience (motivations, objections, language they use), 3–5 competitors or adjacent brands and how " +
      "they show up in video, current creative and platform trends relevant to the channels, and public pages that " +
      "would make good visual references. Finish with hook ideas and visual directions grounded in what you found.",
    effort: "high",
  });
  await report(75);

  const parsed = await structured({
    schema: researchReportSchema,
    effort: "low",
    system: "Convert research notes into the requested structure. Keep every claim faithful to the notes; do not invent sources.",
    content: `Research notes:\n\n${findings.text}\n\nSources found during search:\n${findings.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`,
  });
  await report(95);

  // Keep every source we saw, even ones the summary didn't cite.
  const seen = new Set(parsed.sources.map((s) => s.url));
  for (const s of findings.sources) if (!seen.has(s.url)) parsed.sources.push(s);
  return parsed;
}
