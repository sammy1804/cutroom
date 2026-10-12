import type { Capability, ProviderInfo } from "./types";

export interface CatalogEntry extends ProviderInfo {
  /** Env var holding the credential, if any. */
  credentialEnv?: string;
  /** False until the adapter is implemented (Phase 2+). */
  implemented: boolean;
}

/** Every provider the app knows about. Adding one = add an entry + an adapter. */
export const PROVIDER_CATALOG: CatalogEntry[] = [
  { id: "anthropic", label: "Anthropic Claude", capabilities: ["llm", "research"], credentialEnv: "ANTHROPIC_API_KEY", implemented: true },
  { id: "openai", label: "OpenAI", capabilities: ["llm", "image"], credentialEnv: "OPENAI_API_KEY", implemented: false },
  { id: "local", label: "Local filesystem", capabilities: ["storage"], implemented: true },
  { id: "vercel-blob", label: "Vercel Blob", capabilities: ["storage"], credentialEnv: "BLOB_READ_WRITE_TOKEN", implemented: true },
];

export const CAPABILITY_META: Record<Capability, { label: string; description: string; phase: number }> = {
  llm: { label: "Language model", description: "Briefs, hooks, scripts and copy.", phase: 2 },
  research: { label: "Research", description: "Audience, competitor and trend research.", phase: 2 },
  image: { label: "Image generation", description: "Key visuals, storyboards and thumbnails.", phase: 3 },
  video: { label: "Video generation", description: "Generated shots and b-roll.", phase: 3 },
  voice: { label: "Voice", description: "Voiceover and dubbing.", phase: 3 },
  render: { label: "Rendering", description: "Final exports from the timeline.", phase: 4 },
  storage: { label: "Storage", description: "Uploads, generated media and renders.", phase: 1 },
};
