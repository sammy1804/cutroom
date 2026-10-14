/**
 * Draft Rang De TOFU projects in the local demo workspace: brand palette,
 * client assets from the redesigned site, reference boards from the shared
 * reference videos, the sorted TOFU plan as notes, and two first pieces laid
 * out as connected frames. Local only; re-running replaces the drafts.
 *
 *   pnpm tsx scripts/seed-rangde.ts <reference-contact-sheet-dir>
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const SITE = "https://rangde-kohl.vercel.app";
const BRAND = { ink: "#292D36", blue: "#0DAAE2", deep: "#00517A", green: "#3A6E0C", cream: "#F7F3ED" };

async function main() {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") throw new Error("Local drafts only.");
  const refDir = process.argv[2];
  const { createDb } = await import("../src/server/db/client");
  const { asset, project, reference, user } = await import("../src/server/db/schema");
  const { findMembership, listWorkspacesForUser } = await import("../src/server/services/workspaces");
  const { createProject } = await import("../src/server/services/projects");
  const { replaceBoard } = await import("../src/server/services/board");
  const { getProvider } = await import("../src/server/providers/registry");
  const { storageUrl } = await import("../src/lib/drag");
  const { blankScene, frameSize, newId, LOCAL_SCENE } = await import("../src/lib/board");
  type BoardDoc = import("../src/lib/board").BoardDoc;
  type BoardFrame = import("../src/lib/board").BoardFrame;
  type LooseItem = import("../src/lib/board").LooseItem;
  type SpecElement = import("../src/lib/creative-spec/schema").SpecElement;

  const db = createDb(process.env.DATABASE_URL!);
  try {
    const [demo] = await db.select().from(user).where(eq(user.email, "demo@cutroom.test"));
    if (!demo) throw new Error("Run pnpm db:seed first.");
    const [ws] = await listWorkspacesForUser(db, demo.id);
    const m = (await findMembership(db, demo.id, ws!.slug))!;
    const ctx = { db, userId: demo.id, organization: m.organization, role: m.role };
    const storage = getProvider("storage");

    // Re-running replaces the drafts.
    for (const name of ["Rang De · TOFU awareness", "Rang De · Myth-buster #1"]) {
      await db.delete(project).where(and(eq(project.organizationId, ctx.organization.id), eq(project.name, name)));
    }

    const direction = {
      id: "real-people-first",
      title: "Real people first",
      premise: "Open in the viewer's world, meet a real entrepreneur, end on a fact that makes Rang De click.",
      why: "The two biggest reels (176K, 150K) follow this shape, and the #1 misread is 'it's a donation'.",
      visualTerritory: "Documentary photography (Rohit J), flat brand colour blocks, collage cutouts, honest captions.",
      storytelling: "One person, one place, one need. Numbers as proof, never as the hook.",
      tone: "Warm, plain-spoken, a little playful. Ambition, not sympathy.",
      palette: [BRAND.ink, BRAND.cream, BRAND.blue, BRAND.green, BRAND.deep],
      motion: ["text-kinetic-scale", "text-word-stagger", "image-ken-burns", "transition-whip-pan", "transition-mask-wipe"],
      references: [],
    };

    const tofu = await createProject(ctx, { name: "Rang De · TOFU awareness", description: "Top-of-funnel awareness for Rang De social investing: reach people who've never heard of it.", websiteUrl: "https://rangde.in" });
    await db
      .update(project)
      .set({
        idea: "Make people who've never heard of Rang De stop scrolling for a real entrepreneur, and leave knowing one thing: it's an investment in people, repaid with interest, not a donation.",
        audience: "Never heard (assume it's a donation) and Willing givers (happy to give ₹500, don't expect it back). 22–40, urban India and NRIs, Instagram and YouTube Shorts.",
        format: "9:16",
        stage: "story",
        directions: [direction],
        chosenDirection: direction,
      })
      .where(eq(project.id, tofu.id));

    /* Client assets: the redesign's story photos and logo mark. */
    const clientRights = {
      source: "Rang De (client)",
      sourceUrl: SITE,
      creator: "Rohit J (documentary photographer), via Rang De",
      license: "Client-provided brand asset",
      licenseUrl: null,
      attributionRequired: false,
      commercialUse: true,
      modificationAllowed: true,
      collectedAt: new Date().toISOString(),
      notes: "From Rang De's own site. Confirm photo usage rights and the entrepreneur's consent with Rang De before publishing.",
    };
    const fetched: Record<string, { id: string; url: string }> = {};
    const client = [
      { key: "neilhoupe", name: "Neilhoupe u Koza · apparel", path: "/images/stories/story-1-bg.webp" },
      { key: "sivakumar", name: "Sivakumar · Lantana elephants", path: "/images/stories/story-2-bg.webp" },
      { key: "gita", name: "Gita Devi · fish farm", path: "/images/stories/story-3-bg.webp" },
      { key: "sitara", name: "Sitara Devi · cosmetics store", path: "/images/stories/story-4-bg.webp" },
      { key: "logo", name: "Rang De logo mark", path: "/icons/rangde-logo-mark.svg" },
    ];
    for (const c of client) {
      const res = await fetch(SITE + c.path);
      if (!res.ok) {
        console.warn(`  skipped ${c.path} (${res.status})`);
        continue;
      }
      const body = new Uint8Array(await res.arrayBuffer());
      const ext = c.path.split(".").pop()!;
      const id = crypto.randomUUID();
      const key = `${ctx.organization.id}/assets/${id}.${ext}`;
      await storage.put({ key, body, contentType: res.headers.get("content-type") ?? "image/webp" });
      await db.insert(asset).values({ id, organizationId: ctx.organization.id, projectId: tofu.id, kind: "image", source: "imported", usageStatus: "approved", name: c.name, storageProvider: "local", storageKey: key, externalUrl: SITE + c.path, mimeType: res.headers.get("content-type"), sizeBytes: body.byteLength, rights: clientRights, tags: ["rangde", "client"], metadata: { provider: "rangde-site" }, createdById: ctx.userId });
      fetched[c.key] = { id, url: storageUrl(key)! };
    }

    // No emoji or stickers in the piece: the hook is typography over the brand colour.

    /* References from the shared videos (reference only, never used in the video). */
    const refs = [
      { file: "ref1.jpg", title: "Kya Bolti Public · street vox pop", url: "https://www.instagram.com/officialpeopleofindia/", learnings: ["One question, many faces, fast cuts", "Location tag top-left grounds every answer", "Burned-in caption per answer, centred low"], tags: ["vox-pop", "street", "format"] },
      { file: "ref2.jpg", title: "Pocket Money · 'What was your first salary?'", url: "https://www.instagram.com/pocketmoney.official/", learnings: ["Nostalgia question opens people up", "Sticker maths pops in ('₹150 × 12')", "Older voices + specific years feel true"], tags: ["vox-pop", "money", "#MyFirst500"] },
      { file: "ref3.jpg", title: "Kya Bolti Public · 'This one is for the dreamers'", url: "https://www.instagram.com/officialpeopleofindia/", learnings: ["Aspirational question, varied ages", "Hook word slams in over the first face"], tags: ["vox-pop", "dreams"] },
      { file: "ref4.jpg", title: "Career Speedrun · Mira Murati", url: "https://www.instagram.com/", learnings: ["Collage cutouts on flat colour blocks, a new block every beat", "One line per beat, one accent word in orange", "Ends on a timeline card: the whole story at a glance", "Fully buildable from stills: no shoot needed"], tags: ["collage", "explainer", "speedrun", "template"] },
      { file: "ref5.jpg", title: "Rang De brand film · 'Their story. Your trust.'", url: SITE, learnings: ["Documentary footage hands off to clean UI cards", "Product truth as story: vetted on the ground → listed → backed", "Proof stat overlay (65,000+) while the person stays on screen"], tags: ["brand", "product", "rangde"] },
    ];
    const refItems: LooseItem[] = [];
    if (refDir) {
      for (const [i, r] of refs.entries()) {
        const body = await readFile(path.join(refDir, r.file)).catch(() => null);
        if (!body) continue;
        const id = crypto.randomUUID();
        const key = `${ctx.organization.id}/references/${id}.jpg`;
        await storage.put({ key, body: new Uint8Array(body), contentType: "image/jpeg" });
        await db.insert(reference).values({
          id,
          organizationId: ctx.organization.id,
          projectId: tofu.id,
          url: r.url,
          title: r.title,
          imageKey: key,
          tags: r.tags,
          rank: 80,
          status: "approved",
          createdById: ctx.userId,
          analysis: { summary: r.title, composition: "", palette: [], typography: "", motion: "", artDirection: "", photography: "", learnings: r.learnings, sections: [], relevance: 80, relevanceReason: "Shared by the team as a TOFU reference." },
        });
        refItems.push({ id: newId("i"), kind: "reference", x: i * 320, y: -1220, w: 290, h: 240, referenceId: id, title: r.title, imageUrl: storageUrl(key), url: r.url });
      }
    }

    /* Frames. */
    const style = { background: BRAND.ink, foreground: BRAND.cream, accent: BRAND.blue, font: "sans" as const };
    const { w } = frameSize("9:16");
    type El = Partial<SpecElement> & { type: SpecElement["type"] };
    const frame = (i: number, y: number, bg: string, purpose: SpecElement["type"] extends never ? never : BoardFrame["scene"]["purpose"], duration: number, els: El[], bgPreset?: string): BoardFrame => {
      const counts: Record<string, number> = {};
      const elements = els.map((e) => {
        counts[e.type] = (counts[e.type] ?? 0) + 1;
        const key = counts[e.type]! > 1 ? `${e.type}_${counts[e.type]}` : e.type;
        return { layout: "center" as const, animation: null, ...e, id: `${LOCAL_SCENE}.${key}` } as SpecElement;
      });
      return { id: newId("f"), x: i * (w + 120), y, scene: { ...blankScene(style), purpose, duration, background: { color: bg, preset: bgPreset ? { presetId: bgPreset, params: {} } : null }, elements } };
    };
    const t = (text: string, preset: string, size = 64, layout: SpecElement["layout"] = "center"): El => ({ type: "headline", text, size, layout, animation: { presetId: preset, params: {} } });
    const sub = (text: string, preset = "text-word-stagger", size = 30): El => ({ type: "subtitle", text, size, layout: "bottom", animation: { presetId: preset, params: {} } });
    const img = (a: { id: string; url: string } | undefined, layout: SpecElement["layout"] = "fullbleed", preset = "image-ken-burns"): El[] => (a ? [{ type: "image", assetId: a.id, src: a.url, layout, animation: { presetId: preset, params: {} } }] : []);

    const speedrun: BoardFrame[] = [
      frame(0, 0, BRAND.deep, "hook", 3, [t("He builds life-sized elephants out of a weed.", "text-kinetic-scale", 60)]),
      frame(1, 0, BRAND.ink, "context", 3, [t("The weed is Lantana.", "text-mask-reveal", 64), sub("It chokes India's forests.")], "background-grain"),
      frame(2, 0, BRAND.ink, "turn", 2.5, [...img(fetched.sivakumar), t("Sivakumar turns it into art.", "text-word-stagger", 56, "bottom")]),
      frame(3, 0, BRAND.green, "problem", 2, [t("Art needs working capital.", "text-mask-reveal", 64)]),
      frame(4, 0, BRAND.ink, "proof", 2.5, [t("240 social investors backed him.", "text-kinetic-scale", 60)], "background-grain"),
      frame(5, 0, BRAND.deep, "proof", 3, [t("₹5,00,000", "text-kinetic-scale", 96), sub("Repaid at 6% a year.", "text-blur-in", 34)]),
      frame(6, 0, BRAND.ink, "cta", 3.5, [t("Not a donation. An investment in people.", "text-word-stagger", 52), { type: "cta", text: "Back the next one · rangde.in", size: 30, layout: "bottom", animation: { presetId: "text-blur-in", params: {} } }]),
    ];
    const transitions = ["transition-whip-pan", "transition-mask-wipe", "transition-camera-push", "transition-shape-wipe", "transition-zoom-through", "transition-mask-wipe"];
    const links = speedrun.slice(0, -1).map((f, i) => ({ id: newId("l"), from: f.id, to: speedrun[i + 1]!.id, transition: { presetId: transitions[i]!, params: {} } }));

    const note = (x: number, y: number, text: string, color = "yellow", h = 300, wd = 300): LooseItem => ({ id: newId("i"), kind: "note", x, y, w: wd, h, text, color });
    const notes: LooseItem[] = [
      note(0, -760, "TOFU GOAL\nReach people who've never heard of Rang De. One takeaway: it's an investment in real people, repaid with interest. Not a donation.\n\nMeasure: reach, 3-sec holds, saves, shares, profile visits.", "blue", 260),
      note(330, -760, "TIER 1 · MAKE NOW (weekly engine)\n1. One person, one place, one need (weekly reel)\n2. Myth-busters, 15s each\n3. Entrepreneur Speedrun (collage, this board)\n4. Street: 'Would you lend ₹500 to a stranger?' + #MyFirst500\n5. Cultural calendar: Diwali next (8 Nov)", "green", 260, 320),
      note(680, -760, "TIER 2 · NEXT 4–8 WEEKS (partners)\n6. Micro-creators + craft/food creator visits\n7. 'My first ₹500, six months later'\n8. Founder's blunt question / investor voices\n9. Borrow audiences: meme pages, newsletters, regional creators\n10. 'Made by someone you could back'", "yellow", 260, 320),
      note(1030, -760, "TIER 3 · LATER / MOFU-LEANING\n11. Quiz + 'my impact' card\n12. Borrower map\n13. Back-someone-together circles (RBI P2P compliance check first)\n14. Podcast guest spots (long lead)\n15. Day-in-business vlogs, then-and-now (field partners)\n16. WhatsApp forwards, repayment referrals (retention)", "gray", 260, 320),
      note(1380, -760, "BEFORE POSTING\n• Fact-check Sivakumar's numbers and consent with Rang De (₹5,00,000 · 240 investors · 6% p.a., from the redesign site)\n• Confirm photo rights (Rohit J)\n• Keep 'returns' language compliant: 'up to', past performance", "pink", 260),
    ];
    const palette: LooseItem = { id: newId("i"), kind: "palette", x: 1730, y: -760, w: 300, h: 110, name: "Rang De", colors: [BRAND.ink, BRAND.cream, BRAND.blue, BRAND.green, BRAND.deep] };
    const board: BoardDoc = { version: 2, title: "Entrepreneur Speedrun · Sivakumar", aspect: "9:16", style, frames: speedrun, links, items: [...refItems, ...notes, palette] };
    await replaceBoard(ctx, tofu.id, board);
    console.log(`✓ /w/${ws!.slug}/projects/${tofu.id}/board`);

    /* Second piece: myth-buster #1. */
    const myth = await createProject(ctx, { name: "Rang De · Myth-buster #1", description: "15-second explainer answering the charity misread.", websiteUrl: "https://rangde.in" });
    await db.update(project).set({ idea: "Answer 'Is Rang De a donation?' in 15 seconds.", format: "9:16", stage: "story", directions: [direction], chosenDirection: direction }).where(eq(project.id, myth.id));
    const mframes: BoardFrame[] = [
      frame(0, 0, BRAND.ink, "hook", 2, [t("Is Rang De a donation?", "text-typewriter", 60)]),
      frame(1, 0, BRAND.deep, "turn", 1.5, [t("No.", "text-kinetic-scale", 160)]),
      frame(2, 0, BRAND.ink, "context", 3.5, [t("You lend to a real entrepreneur.", "text-word-stagger", 52), sub("They repay every month. You earn interest.")]),
      frame(3, 0, BRAND.green, "proof", 3, [t("Up to 8% p.a.", "text-kinetic-scale", 88), sub("On an RBI-regulated platform.", "text-blur-in")]),
      frame(4, 0, BRAND.ink, "cta", 3, [t("Not charity. Social investing.", "text-mask-reveal", 56), { type: "cta", text: "Meet them · rangde.in", size: 30, layout: "bottom", animation: { presetId: "text-blur-in", params: {} } }]),
    ];
    const mlinks = mframes.slice(0, -1).map((f, i) => ({ id: newId("l"), from: f.id, to: mframes[i + 1]!.id, transition: i === 0 ? null : { presetId: "transition-mask-wipe", params: {} } }));
    await replaceBoard(ctx, myth.id, { version: 2, title: "Not a donation.", aspect: "9:16", style, frames: mframes, links: mlinks, items: [note(0, -380, "MYTH-BUSTER #1\nThe #1 misread from segmentation: 'Never heard → assumes it's a donation'.\nNext in series: 'Not crowdfunding', 'Is my money safe?', 'Who checks the borrower?'", "blue", 240, 340)] });
    console.log(`✓ /w/${ws!.slug}/projects/${myth.id}/board`);
  } finally {
    await db.$client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
