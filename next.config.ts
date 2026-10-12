import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
  serverExternalPackages: ["pg", "playwright", "playwright-core", "@sparticuz/chromium"],
  // A package-lock.json in the home directory otherwise confuses root detection.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
