import type { ProviderContext, ProviderInfo, ProviderUsage } from "../types";

export type AspectRatio = "9:16" | "1:1" | "4:5" | "16:9";

/** Media generation is asynchronous: submit, then poll or receive a webhook. */
export interface GenerationHandle {
  providerJobId: string;
}

export type GenerationStatus =
  | { state: "pending"; progress?: number }
  | { state: "succeeded"; outputs: GeneratedMedia[]; usage?: ProviderUsage }
  | { state: "failed"; error: string };

export interface GeneratedMedia {
  /** Temporary provider URL; callers copy it into StorageProvider before persisting. */
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

interface AsyncGenerator<TRequest> {
  info: ProviderInfo;
  submit(request: TRequest, ctx: ProviderContext): Promise<GenerationHandle>;
  status(handle: GenerationHandle, ctx: ProviderContext): Promise<GenerationStatus>;
  cancel?(handle: GenerationHandle, ctx: ProviderContext): Promise<void>;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  count?: number;
  referenceAssetUrls?: string[];
  model?: string;
}
export type ImageProvider = AsyncGenerator<ImageRequest>;

export interface VideoRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  /** Optional first frame / reference images. */
  referenceAssetUrls?: string[];
  model?: string;
}
export type VideoProvider = AsyncGenerator<VideoRequest>;

export interface VoiceRequest {
  text: string;
  voiceId: string;
  language?: string;
  speed?: number;
}
export type VoiceProvider = AsyncGenerator<VoiceRequest> & {
  listVoices?(ctx: ProviderContext): Promise<{ id: string; name: string; language?: string }[]>;
};
