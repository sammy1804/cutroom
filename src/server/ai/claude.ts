import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AppError } from "@/server/errors";
import { estimateCost, recordUsage } from "./usage";

/**
 * The single place the app talks to Claude.
 *
 * Every request goes through the beta Messages endpoint so it can carry
 * server-side refusal fallbacks (`fallbacks: "default"`): if a request is
 * declined by a safety classifier, the API re-runs it on a fallback model
 * inside the same call instead of returning nothing.
 */

export const CLAUDE_MODEL = "claude-opus-5-5";
const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

let client: Anthropic | undefined;

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claude(): Anthropic {
  if (!isClaudeConfigured()) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Claude isn't connected yet. Add ANTHROPIC_API_KEY to .env.local and restart the server.",
    );
  }
  client ??= new Anthropic({ maxRetries: 3 });
  return client;
}

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
type Content = string | Anthropic.Beta.BetaContentBlockParam[];

interface StructuredOptions<S extends z.ZodType> {
  schema: S;
  system: string;
  content: Content;
  effort?: Effort;
  maxTokens?: number;
  /** Stable, cacheable context (e.g. the animation catalog) placed before the volatile request. */
  cachedContext?: string;
}

/** One request → validated, typed JSON. */
export async function structured<S extends z.ZodType>(opts: StructuredOptions<S>): Promise<z.infer<S>> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: opts.system }];
  if (opts.cachedContext) {
    system.push({ type: "text", text: opts.cachedContext, cache_control: { type: "ephemeral" } });
  }
  try {
    const response = await claude().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
      system,
      messages: [{ role: "user", content: opts.content }],
    });
    track(response.usage);
    assertUsable(response);
    if (response.parsed_output == null) {
      throw new AppError("INTERNAL", "Claude returned a response that didn't match the expected format.");
    }
    return response.parsed_output as z.infer<S>;
  } catch (error) {
    throw toAppError(error);
  }
}

interface WebResearchOptions {
  system: string;
  prompt: string;
  effort?: Effort;
  maxSearches?: number;
  allowedDomains?: string[];
}

export interface WebResearchResult {
  text: string;
  sources: { url: string; title: string }[];
}

/**
 * Runs a research turn with Anthropic's server-side web search and web fetch.
 * Handles `pause_turn` by resuming until Claude finishes.
 */
export async function webResearch(opts: WebResearchOptions): Promise<WebResearchResult> {
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: opts.maxSearches ?? 8,
      ...(opts.allowedDomains?.length ? { allowed_domains: opts.allowedDomains } : {}),
    },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const sources = new Map<string, string>();
  let finalText = "";

  try {
    for (let turn = 0; turn < 6; turn++) {
      const stream = claude().beta.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 64000,
        betas: BETAS,
        fallbacks: "default",
        output_config: { effort: opts.effort ?? "high" },
        system: opts.system,
        tools,
        messages,
      });
      const message = await stream.finalMessage();
      track(message.usage);
      assertUsable(message);

      for (const block of message.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const result of block.content) {
            if (result.type === "web_search_result") sources.set(result.url, result.title);
          }
        }
        if (block.type === "text") finalText += block.text;
      }

      if (message.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: message.content });
      finalText = "";
    }
  } catch (error) {
    throw toAppError(error);
  }

  return { text: finalText.trim(), sources: [...sources].map(([url, title]) => ({ url, title })) };
}

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

function track(u: Usage) {
  const record = {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    webSearches: u.server_tool_use?.web_search_requests ?? 0,
  };
  recordUsage({ provider: "anthropic", model: CLAUDE_MODEL, ...record, costUsd: estimateCost(CLAUDE_MODEL, record) });
}

function assertUsable(message: { stop_reason: string | null; stop_details?: unknown }) {
  if (message.stop_reason === "refusal") {
    throw new AppError("PROVIDER_UNAVAILABLE", "Claude declined this request. Try rephrasing it.");
  }
}

function toAppError(error: unknown): unknown {
  if (error instanceof AppError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new AppError("PROVIDER_UNAVAILABLE", "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError("PROVIDER_UNAVAILABLE", "Claude is rate limited right now. Try again in a minute.");
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error("[claude] bad request", error.message);
    return new AppError("INTERNAL", "Claude rejected the request.");
  }
  if (error instanceof Anthropic.APIError) {
    console.error("[claude] api error", error.status, error.message);
    return new AppError("PROVIDER_UNAVAILABLE", "Claude is unavailable right now. Try again shortly.");
  }
  return error;
}

/** Image block from bytes, for screenshots and thumbnails. */
export function imageBlock(data: Uint8Array, mediaType: "image/jpeg" | "image/png" | "image/webp"): Anthropic.Beta.BetaImageBlockParam {
  return { type: "image", source: { type: "base64", media_type: mediaType, data: Buffer.from(data).toString("base64") } };
}
