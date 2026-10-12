import type { ProviderInfo } from "../types";

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface StorageProvider {
  info: ProviderInfo;
  put(input: PutObjectInput): Promise<{ key: string; size: number }>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** A URL the browser can load. Signed for remote stores; an app route for local. */
  url(key: string): Promise<string>;
}
