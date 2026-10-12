import type { ProviderContext, ProviderInfo, ProviderUsage } from "../types";

export interface ResearchQuery {
  question: string;
  /** Brand, competitor or product URLs to ground the research in. */
  seedUrls?: string[];
  depth?: "quick" | "standard" | "deep";
}

export interface ResearchSource {
  url: string;
  title: string;
  excerpt?: string;
}

export interface ResearchResult {
  summary: string;
  findings: { claim: string; sourceUrls: string[] }[];
  sources: ResearchSource[];
  usage?: ProviderUsage;
}

export interface ResearchProvider {
  info: ProviderInfo;
  research(query: ResearchQuery, ctx: ProviderContext): Promise<ResearchResult>;
}
