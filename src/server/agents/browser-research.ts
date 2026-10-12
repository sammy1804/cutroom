import "server-only";
import { chromium, type Browser, type Page } from "playwright-core";
import { z } from "zod";
import type { AIProvider } from "@/server/ai/provider";
import { reference, type Reference } from "@/server/db/schema";
import { getProvider } from "@/server/providers/registry";
import type { WorkspaceContext } from "@/server/services/context";
import { resolveApprovedSite } from "@/server/services/sources";
import type { ReferenceAnalysis } from "@/lib/creative-types";

/**
 * BrowserResearchAgent: visual research, not text scraping.
 *
 * open → render → capture → analyse composition → find relevant sections →
 * crop them → save as references with metadata → rank against the brief.
 * Only approved sites (Source Registry or a project's own website) are opened.
 */

const VIEWPORT = { width: 1440, height: 900 };
const CHUNK_HEIGHT = 1800;
const MAX_CHUNKS = 3;
const MAX_SECTION_CROPS = 3;

const analysisSchema = z.object({
  title: z.string().describe("Short name for this reference, e.g. 'Aesop — editorial product grid'"),
  summary: z.string(),
  composition: z.string(),
  palette: z.array(z.string()).describe("Dominant colours as hex codes"),
  typography: z.string(),
  motion: z.string().describe("Motion cues visible or implied (scroll effects, transitions, video). Say 'static' if none."),
  artDirection: z.string(),
  photography: z.string(),
  learnings: z.array(z.string()).describe("2–5 reusable lessons phrased as direction, e.g. 'Let one oversized serif headline carry the frame'"),
  tags: z.array(z.string()).describe("6–12 lowercase search tags: style, mood, technique"),
  sections: z
    .array(z.object({ label: z.string(), top: z.number(), bottom: z.number(), why: z.string() }))
    .describe("Up to 3 most useful regions, in page pixels from the top"),
  relevance: z.number().describe("0–100: how useful this is for the brief"),
  relevanceReason: z.string(),
});

export interface CaptureInput {
  url: string;
  brief: string;
  projectId: string | null;
  campaignId: string | null;
  jobId: string;
  /** From the skill: its SKILL.md instructions and the AI provider to use. */
  instructions: string;
  ai: AIProvider;
}

export async function captureReference(
  ctx: WorkspaceContext,
  input: CaptureInput,
  report: (p: number) => Promise<void>,
): Promise<{ referenceIds: string[] }> {
  const approved = await resolveApprovedSite(ctx, input.url);
  const storage = getProvider("storage");
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await settleLazyContent(page);
    await report(25);

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const captureHeight = Math.min(pageHeight, CHUNK_HEIGHT * MAX_CHUNKS);
    const chunks: Buffer[] = [];
    for (let top = 0; top < captureHeight; top += CHUNK_HEIGHT) {
      const height = Math.min(CHUNK_HEIGHT, captureHeight - top);
      chunks.push(await page.screenshot({ type: "jpeg", quality: 80, fullPage: true, clip: { x: 0, y: top, width: VIEWPORT.width, height } }));
    }
    const full = await page.screenshot({ type: "jpeg", quality: 78, fullPage: true, clip: { x: 0, y: 0, width: VIEWPORT.width, height: captureHeight } });
    const outline = await page.evaluate(outlineSections);
    const pageTitle = await page.title();
    await report(45);

    const analysis = await input.ai.structured({
      schema: analysisSchema,
      effort: "medium",
      system: input.instructions,
      content: [
        ...chunks.map((c) => ({ type: "image" as const, data: new Uint8Array(c), mediaType: "image/jpeg" as const })),
        {
          type: "text",
          text:
            `These are consecutive ${VIEWPORT.width}px-wide screenshots of ${input.url} ("${pageTitle}"), each ${CHUNK_HEIGHT}px tall, top to bottom.\n` +
            `DOM section outline (page pixels): ${JSON.stringify(outline)}\n\n` +
            `Brief this research is for:\n${input.brief}\n\nAnalyse the page as a visual reference for this brief.`,
        },
      ],
    });
    await report(75);

    const saved: Reference[] = [];
    const mainId = crypto.randomUUID();
    const mainKey = `${ctx.organization.id}/references/${mainId}.jpg`;
    await storage.put({ key: mainKey, body: full, contentType: "image/jpeg" });
    const meta: ReferenceAnalysis = { ...analysis };
    const [main] = await ctx.db
      .insert(reference)
      .values({
        id: mainId,
        organizationId: ctx.organization.id,
        projectId: input.projectId,
        campaignId: input.campaignId,
        sourceId: approved.sourceId,
        url: input.url,
        title: analysis.title,
        imageKey: mainKey,
        width: VIEWPORT.width,
        height: captureHeight,
        analysis: meta,
        tags: analysis.tags.map((t) => t.toLowerCase()),
        rank: clampRank(analysis.relevance),
        jobId: input.jobId || null,
        createdById: ctx.userId,
      })
      .returning();
    saved.push(main!);

    for (const section of analysis.sections.slice(0, MAX_SECTION_CROPS)) {
      const top = Math.max(0, Math.round(section.top));
      const bottom = Math.min(captureHeight, Math.round(section.bottom));
      if (bottom - top < 120) continue;
      const crop = await page.screenshot({ type: "jpeg", quality: 82, fullPage: true, clip: { x: 0, y: top, width: VIEWPORT.width, height: bottom - top } });
      const id = crypto.randomUUID();
      const key = `${ctx.organization.id}/references/${id}.jpg`;
      await storage.put({ key, body: crop, contentType: "image/jpeg" });
      const [row] = await ctx.db
        .insert(reference)
        .values({
          id,
          organizationId: ctx.organization.id,
          projectId: input.projectId,
          campaignId: input.campaignId,
          sourceId: approved.sourceId,
          parentId: mainId,
          url: input.url,
          title: `${analysis.title} · ${section.label}`,
          imageKey: key,
          width: VIEWPORT.width,
          height: bottom - top,
          analysis: { ...meta, summary: section.why, sections: [] },
          tags: analysis.tags.map((t) => t.toLowerCase()),
          rank: clampRank(analysis.relevance - 5),
          jobId: input.jobId || null,
          createdById: ctx.userId,
        })
        .returning();
      saved.push(row!);
    }
    return { referenceIds: saved.map((r) => r.id) };
  } finally {
    await browser?.close();
  }
}

/** Local: Playwright's installed Chromium. Vercel: a serverless build of Chromium. */
async function launchBrowser() {
  if (process.env.VERCEL) {
    const { default: serverless } = await import("@sparticuz/chromium");
    return chromium.launch({ executablePath: await serverless.executablePath(), args: serverless.args, headless: true });
  }
  return chromium.launch({ headless: true });
}

/** Scroll through the page so lazy images and scroll-triggered content render. */
async function settleLazyContent(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    const max = Math.min(document.documentElement.scrollHeight, 6000);
    for (let y = 0; y < max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 250));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

/** Runs in the browser: large top-level blocks with their first heading. */
function outlineSections() {
  const nodes = Array.from(document.querySelectorAll("header, section, main > *, footer, [class*='hero']"));
  const out: { tag: string; heading: string; top: number; bottom: number }[] = [];
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.height < 200 || rect.width < 600) continue;
    const top = Math.round(rect.top + window.scrollY);
    if (out.some((o) => Math.abs(o.top - top) < 40)) continue;
    const heading = node.querySelector("h1, h2, h3")?.textContent?.trim().slice(0, 80) ?? "";
    out.push({ tag: node.tagName.toLowerCase(), heading, top, bottom: Math.round(top + rect.height) });
    if (out.length >= 14) break;
  }
  return out;
}

const clampRank = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
