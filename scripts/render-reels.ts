/**
 * Renders the reference reels in src/remotion to public/reference-videos.
 *   pnpm render:reels            (all)
 *   pnpm render:reels HaldenAd   (one)
 * Uses Playwright's headless Chromium so no extra browser download is needed.
 */
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const OUT = path.resolve("public/reference-videos");
const REELS: { id: string; file: string; scale: number }[] = [
  { id: "LibraryReel", file: "library-reel-16x9.mp4", scale: 3 },
  { id: "TransitionsReel", file: "transitions-reel-16x9.mp4", scale: 3 },
  { id: "CaptionsPack", file: "captions-pack-9x16.mp4", scale: 1.5 },
  { id: "HaldenAd", file: "halden-ad-9x16.mp4", scale: 1.5 },
];

function playwrightShell(): string | undefined {
  const root = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell")).sort().pop();
  if (!dir) return undefined;
  const bin = path.join(root, dir, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
  return existsSync(bin) ? bin : undefined;
}

async function main() {
  const only = process.argv[2];
  const serveUrl = await bundle({
    entryPoint: path.resolve("src/remotion/index.ts"),
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.resolve("src") } },
    }),
  });
  const browserExecutable = process.env.REMOTION_BROWSER ?? playwrightShell();
  for (const reel of REELS.filter((r) => !only || r.id === only)) {
    const composition = await selectComposition({ serveUrl, id: reel.id, browserExecutable });
    const outputLocation = path.join(OUT, reel.file);
    const started = Date.now();
    let lastStep = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      scale: reel.scale,
      browserExecutable,
      crf: 20,
      onProgress: ({ progress }) => {
        const step = Math.floor(progress * 10);
        if (step !== lastStep) {
          lastStep = step;
          process.stdout.write(`${reel.id} ${step * 10}%\n`);
        }
      },
    });
    console.log(`\n✓ ${reel.file} (${composition.width * reel.scale}x${composition.height * reel.scale}, ${(composition.durationInFrames / composition.fps).toFixed(1)}s) in ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
