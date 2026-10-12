/** Types inferred from skill output schemas, for UI code that renders skill results. */
import type { z } from "zod";
import type { brainReplySchema } from "@skills/creative/brainstorm/skill";
import type { animationSearchOutput } from "@skills/motion/animation-search/skill";
import type { sourcingOutput } from "@skills/production/asset-search/skill";
import type { qualityReportSchema } from "@skills/production/quality-control/skill";
import type { researchReportSchema } from "@skills/research/web-research/skill";

export type ResearchReport = z.infer<typeof researchReportSchema>;
export type AnimationSearchResult = z.infer<typeof animationSearchOutput>;
export type SourcingResult = z.infer<typeof sourcingOutput>;
export type RankedCandidate = SourcingResult["candidates"][number];
export type QualityReport = z.infer<typeof qualityReportSchema>;
export type BrainReply = z.infer<typeof brainReplySchema>;
