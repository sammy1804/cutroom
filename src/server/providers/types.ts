/**
 * Provider abstraction.
 *
 * The app never calls a vendor SDK directly. Each *capability* (llm, research,
 * image, video, voice, render, storage) has a typed interface in ./capabilities,
 * and concrete adapters in ./adapters implement one or more of them. Which adapter
 * serves a capability is configuration (env), resolved by ./registry.
 *
 * Phase 1 ships the interfaces, the registry and the local storage adapter.
 * Generation adapters arrive in Phase 2+ without changes to callers.
 */

export const CAPABILITIES = ["llm", "research", "image", "video", "voice", "render", "storage"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface ProviderInfo {
  /** Stable id used in env config, e.g. "anthropic", "local". */
  id: string;
  label: string;
  capabilities: readonly Capability[];
}

/** Shared context passed to every provider call, for attribution, cancellation and cost tracking. */
export interface ProviderContext {
  organizationId: string;
  userId?: string;
  jobId?: string;
  signal?: AbortSignal;
}

export interface ProviderUsage {
  inputUnits?: number;
  outputUnits?: number;
  /** What the units measure: tokens, seconds, images, characters… */
  unit?: string;
  costUsd?: number;
}

export type CapabilityStatus =
  | { state: "ready"; provider: ProviderInfo }
  | { state: "unconfigured"; reason: string }
  | { state: "missing_credentials"; provider: ProviderInfo; reason: string }
  | { state: "planned"; provider: ProviderInfo; reason: string };
