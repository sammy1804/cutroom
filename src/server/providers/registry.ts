import { env } from "@/env";
import { AppError } from "@/server/errors";
import { anthropicLlm, anthropicResearch } from "./adapters/anthropic";
import { createLocalStorage } from "./adapters/local-storage";
import { createVercelBlobStorage } from "./adapters/vercel-blob";
import { PROVIDER_CATALOG } from "./catalog";
import type { LlmProvider } from "./capabilities/llm";
import type { ImageProvider, VideoProvider, VoiceProvider } from "./capabilities/media";
import type { RenderProvider } from "./capabilities/render";
import type { ResearchProvider } from "./capabilities/research";
import type { StorageProvider } from "./capabilities/storage";
import { CAPABILITIES, type Capability, type CapabilityStatus } from "./types";

interface CapabilityMap {
  llm: LlmProvider;
  research: ResearchProvider;
  image: ImageProvider;
  video: VideoProvider;
  voice: VoiceProvider;
  render: RenderProvider;
  storage: StorageProvider;
}

type ConfigSource = Partial<Record<string, string | undefined>>;

const CONFIG_KEY: Record<Capability, string> = {
  llm: "LLM_PROVIDER",
  research: "RESEARCH_PROVIDER",
  image: "IMAGE_PROVIDER",
  video: "VIDEO_PROVIDER",
  voice: "VOICE_PROVIDER",
  render: "RENDER_PROVIDER",
  storage: "STORAGE_PROVIDER",
};

/** Pure: works out each capability's status from config, without constructing anything. */
export function resolveCapabilityStatus(capability: Capability, config: ConfigSource): CapabilityStatus {
  const providerId = config[CONFIG_KEY[capability]] ?? "none";
  if (!providerId || providerId === "none") {
    return { state: "unconfigured", reason: `Set ${CONFIG_KEY[capability]} to enable.` };
  }
  const entry = PROVIDER_CATALOG.find((p) => p.id === providerId);
  if (!entry || !entry.capabilities.includes(capability)) {
    return { state: "unconfigured", reason: `"${providerId}" does not provide ${capability}.` };
  }
  if (entry.credentialEnv && !config[entry.credentialEnv]) {
    return { state: "missing_credentials", provider: entry, reason: `${entry.credentialEnv} is empty.` };
  }
  if (!entry.implemented) {
    return { state: "planned", provider: entry, reason: "Adapter ships in a later phase." };
  }
  return { state: "ready", provider: entry };
}

/** Effective config: explicit env, plus the Vercel Blob default when a Blob token is present. */
function effectiveConfig(): ConfigSource {
  return { ...(process.env.BLOB_READ_WRITE_TOKEN && !process.env.STORAGE_PROVIDER ? { STORAGE_PROVIDER: "vercel-blob" } : {}), ...process.env };
}

export function getCapabilityStatuses(config: ConfigSource = effectiveConfig()) {
  return CAPABILITIES.map((capability) => ({
    capability,
    status: resolveCapabilityStatus(capability, config),
  }));
}

const factories: { [C in Capability]?: Record<string, () => CapabilityMap[C]> } = {
  storage: { local: () => createLocalStorage(env.STORAGE_LOCAL_DIR), "vercel-blob": () => createVercelBlobStorage() },
  llm: { anthropic: () => anthropicLlm },
  research: { anthropic: () => anthropicResearch },
};

const instances = new Map<string, unknown>();

/** Returns the configured provider for a capability, or throws PROVIDER_UNAVAILABLE. */
export function getProvider<C extends Capability>(capability: C): CapabilityMap[C] {
  const status = resolveCapabilityStatus(capability, effectiveConfig());
  if (status.state !== "ready") {
    throw new AppError("PROVIDER_UNAVAILABLE", `${capability} is not available: ${status.reason}`);
  }
  const id = status.provider.id;
  const cacheKey = `${capability}:${id}`;
  if (!instances.has(cacheKey)) {
    const factory = factories[capability]?.[id];
    if (!factory) throw new AppError("NOT_IMPLEMENTED", `No ${capability} adapter for "${id}".`);
    instances.set(cacheKey, factory());
  }
  return instances.get(cacheKey) as CapabilityMap[C];
}
