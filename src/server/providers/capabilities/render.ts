import type { ProviderContext, ProviderInfo } from "../types";
import type { AspectRatio, GenerationHandle, GenerationStatus } from "./media";

/**
 * Renderer-agnostic composition description. The timeline editor (Phase 3+)
 * produces this; a render provider turns it into a video file.
 */
export interface Composition {
  version: 1;
  aspectRatio: AspectRatio;
  fps: number;
  durationMs: number;
  tracks: CompositionTrack[];
}

export interface CompositionTrack {
  id: string;
  kind: "video" | "image" | "audio" | "text" | "caption";
  clips: CompositionClip[];
}

export interface CompositionClip {
  id: string;
  /** Asset id for media clips; omitted for text. */
  assetId?: string;
  text?: string;
  startMs: number;
  durationMs: number;
  /** Offset into the source media. */
  trimStartMs?: number;
  props?: Record<string, unknown>;
}

export interface RenderRequest {
  composition: Composition;
  format: "mp4" | "webm" | "mov";
  quality?: "draft" | "final";
}

export interface RenderProvider {
  info: ProviderInfo;
  submit(request: RenderRequest, ctx: ProviderContext): Promise<GenerationHandle>;
  status(handle: GenerationHandle, ctx: ProviderContext): Promise<GenerationStatus>;
}
