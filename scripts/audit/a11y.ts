/**
 * Accessibility scan: signs in as the seed user and runs axe-core (WCAG 2.1 A/AA)
 * on every main screen, in light and dark themes.  Usage: pnpm audit:a11y
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_URL ?? "http://localhost:3000";
const EMAIL = "demo@cutroom.test";
const PASSWORD = "cutroom-demo-1";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Public pages first.
  const results: { page: string; theme: string; id: string; impact: string; help: string; nodes: number; sample: string }[] = [];
  const scan = async (label: string, theme: string) => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of r.violations) {
      results.push({ page: label, theme, id: v.id, impact: v.impact ?? "", help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(" ") + (n.failureSummary ? ` :: ${n.failureSummary.split("\n").slice(1, 2).join("")}` : "")).join(" | ") });
    }
  };

  for (const theme of ["light", "dark"]) {
    await page.goto(`${BASE}/sign-in`);
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);
    await page.reload();
    await page.waitForTimeout(800);
    await scan("/sign-in", theme);
  }

  await page.goto(`${BASE}/sign-in`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/w\//, { timeout: 120000 });
  const ws = new URL(page.url()).pathname.split("/").slice(0, 3).join("/");

  const projectHref = await (async () => {
    await page.goto(`${BASE}${ws}/projects`);
    return page.locator("table a[href*='/projects/']").first().getAttribute("href");
  })();
  await page.goto(`${BASE}${projectHref}`);
  const campaignHref = await page.locator("a[href*='/campaigns/']").first().getAttribute("href");

  const pages = [
    ws,
    `${ws}/projects`,
    `${ws}/projects/new`,
    projectHref!,
    `${projectHref}?tab=references`,
    `${projectHref}?tab=dna`,
    campaignHref!,
    `${ws}/library?tab=animations`,
    `${ws}/library?tab=free`,
    `${ws}/library?tab=assets`,
    `${ws}/memory`,
    `${ws}/settings`,
    `${ws}/settings/members`,
    `${ws}/settings/sources`,
  ];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);
    for (const p of pages) {
      await page.goto(`${BASE}${p}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1200);
      await scan(p.replace(ws, "/w/:slug").replace(/[0-9a-f-]{36}/g, ":id"), theme);
    }
  }

  // Keyboard: tab through the shell and record what receives focus and whether it shows a ring.
  await page.goto(`${BASE}${ws}`);
  await page.waitForTimeout(1000);
  const focusLog: string[] = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    focusLog.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "none";
        const cs = getComputedStyle(el);
        const ring = cs.outlineStyle !== "none" && cs.outlineWidth !== "0px" ? "outline" : cs.boxShadow !== "none" ? "shadow" : "NO-VISIBLE-FOCUS";
        const name = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.tagName;
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)} ${ring}`;
      }),
    );
  }

  // Target sizes of interactive elements on the dashboard.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a, button, [role=button], input, select")]
      .filter((el) => el.offsetParent)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 24 || r.height < 24)
      .map(({ el, r }) => `${el.tagName.toLowerCase()} "${el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
  );

  // 200% zoom: horizontal overflow check.
  await page.setViewportSize({ width: 720, height: 900 });
  const overflow: string[] = [];
  for (const p of pages.slice(0, 8)) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(800);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) overflow.push(`${p.replace(ws, "/w/:slug").replace(/[0-9a-f-]{36}/g, ":id")} overflows by ${o}px`);
  }

  await browser.close();
  const out = { results, focusLog, small, overflow };
  writeFileSync(process.env.AUDIT_OUT ?? "a11y-report.json", JSON.stringify(out, null, 2));
  const grouped = new Map<string, { impact: string; help: string; pages: Set<string>; nodes: number; sample: string }>();
  for (const r of results) {
    const g = grouped.get(r.id) ?? { impact: r.impact, help: r.help, pages: new Set(), nodes: 0, sample: r.sample };
    g.pages.add(`${r.page} (${r.theme})`);
    g.nodes += r.nodes;
    grouped.set(r.id, g);
  }
  for (const [id, g] of grouped) console.log(`\n[${g.impact}] ${id}: ${g.help}\n  nodes=${g.nodes} pages=${[...g.pages].slice(0, 6).join(", ")}${g.pages.size > 6 ? ` +${g.pages.size - 6}` : ""}\n  e.g. ${g.sample.slice(0, 300)}`);
  console.log("\nFOCUS:\n" + focusLog.join("\n"));
  console.log("\nSMALL TARGETS (<24px):\n" + small.join("\n"));
  console.log("\nREFLOW @720px:\n" + (overflow.join("\n") || "none"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
