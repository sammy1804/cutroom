import { openverse } from "./openverse";
import { pexels } from "./pexels";
import { pixabay } from "./pixabay";
import type { AssetSearchProvider } from "./types";
import { wikimedia } from "./wikimedia";

export const ASSET_PROVIDERS: Record<string, AssetSearchProvider> = { openverse, wikimedia, pexels, pixabay };
export * from "./types";
