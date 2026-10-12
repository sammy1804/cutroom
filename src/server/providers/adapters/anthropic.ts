import Anthropic from "@anthropic-ai/sdk";
import { claude, CLAUDE_MODEL, webResearch } from "@/server/ai/claude";
import type { LlmProvider } from "../capabilities/llm";
import type { ResearchProvider } from "../capabilities/research";

const info = { id: "anthropic", label: "Anthropic Claude", capabilities: ["llm", "research"] as const };

/** Generic LLM capability backed by Claude. Agents use server/ai/claude helpers directly for richer features. */
export const anthropicLlm: LlmProvider = {
  info,
  async complete(request) {
    const system = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const messages: Anthropic.Beta.BetaMessageParam[] = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    const res = await claude().beta.messages.create({
      model: request.model ?? CLAUDE_MODEL,
      max_tokens: request.maxTokens ?? 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(system ? { system } : {}),
      messages,
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { text, usage: { inputUnits: res.usage.input_tokens, outputUnits: res.usage.output_tokens, unit: "tokens" } };
  },
};

export const anthropicResearch: ResearchProvider = {
  info,
  async research(query) {
    const result = await webResearch({
      system: "You are a careful researcher. Cite sources for every claim.",
      prompt: `${query.question}${query.seedUrls?.length ? `\nStart from: ${query.seedUrls.join(", ")}` : ""}`,
      effort: query.depth === "deep" ? "high" : query.depth === "quick" ? "low" : "medium",
    });
    return { summary: result.text, findings: [], sources: result.sources };
  },
};
