import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-run usage collection. The skill runtime opens a collector; every provider
 * call made while it is active records tokens and estimated cost into it, so a
 * skill run knows exactly what it spent without threading counters by hand.
 */

export interface UsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  costUsd: number;
}

/** USD per million tokens (input, output, cache read, cache write) and per web search. */
const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number; search: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5, search: 0.01 },
};

export function estimateCost(model: string, u: Omit<UsageRecord, "provider" | "model" | "costUsd">): number {
  const p = PRICES[model];
  if (!p) return 0;
  const m = 1_000_000;
  return (u.inputTokens * p.in + u.outputTokens * p.out + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / m + u.webSearches * p.search;
}

const store = new AsyncLocalStorage<UsageRecord[]>();

export function withUsageCollector<T>(fn: () => Promise<T>): Promise<{ result: T; usage: UsageRecord[] }> {
  const records: UsageRecord[] = [];
  return store.run(records, async () => ({ result: await fn(), usage: records }));
}

export function recordUsage(record: UsageRecord) {
  store.getStore()?.push(record);
}

export function sumUsage(records: UsageRecord[]) {
  return records.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      costUsd: acc.costUsd + r.costUsd,
      provider: acc.provider || r.provider,
      model: acc.model || r.model,
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0, provider: "", model: "" },
  );
}
