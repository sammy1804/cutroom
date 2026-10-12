import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { AppError } from "@/server/errors";
import { imageBlock, isClaudeConfigured, structured, webResearch, type WebResearchResult } from "./claude";

/**
 * AIProvider: what skills are allowed to ask of an AI model. Skills never import
 * a vendor SDK; the runtime hands them a provider. Claude is the only
 * implementation today; others plug in behind the same interface.
 */

export type Effort = "low" | "medium" | "high";

export type AIContent = string | AIContentPart[];
export type AIContentPart = { type: "text"; text: string } | { type: "image"; data: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  content: AIContent;
  effort?: Effort;
  maxTokens?: number;
  /** Large stable context (catalogs, instructions) the provider may cache. */
  cachedContext?: string;
}

export interface ResearchRequest {
  system: string;
  prompt: string;
  effort?: Effort;
  maxSearches?: number;
  allowedDomains?: string[];
}

export interface AIProvider {
  id: string;
  label: string;
  available(): boolean;
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
  research(req: ResearchRequest): Promise<WebResearchResult>;
}

function toClaudeContent(content: AIContent): string | Anthropic.Beta.BetaContentBlockParam[] {
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? { type: "text" as const, text: part.text } : imageBlock(part.data, part.mediaType)));
}

export const claudeProvider: AIProvider = {
  id: "anthropic",
  label: "Claude",
  available: isClaudeConfigured,
  structured: (req) => structured({ ...req, content: toClaudeContent(req.content) }),
  research: (req) => webResearch(req),
};

const PROVIDERS: Record<string, AIProvider> = { anthropic: claudeProvider };

/** The configured provider for reasoning work (LLM_PROVIDER, default Claude). */
export function getAIProvider(): AIProvider {
  const id = process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "none" ? process.env.LLM_PROVIDER : "anthropic";
  const provider = PROVIDERS[id];
  if (!provider) throw new AppError("PROVIDER_UNAVAILABLE", `No AI provider called "${id}".`);
  return provider;
}
