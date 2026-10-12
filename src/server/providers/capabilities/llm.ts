import type { ProviderContext, ProviderInfo, ProviderUsage } from "../types";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** When set, the provider must return JSON matching this schema. */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmResponse {
  text: string;
  json?: unknown;
  usage?: ProviderUsage;
}

export interface LlmProvider {
  info: ProviderInfo;
  complete(request: LlmRequest, ctx: ProviderContext): Promise<LlmResponse>;
  stream?(request: LlmRequest, ctx: ProviderContext): AsyncIterable<string>;
}
