/**
 * Exports a project's board from the local database as a board pack, for
 * importing into another workspace (Projects → Import board).
 *
 *   pnpm board:export "<project name>" [out-dir]   # writes <out-dir>/<slug>.cutroom.json (default ./exports, git-ignored)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const [name, outDir = "exports"] = process.argv.slice(2);
  if (!name) throw new Error('Usage: pnpm board:export "<project name>" [out-dir]');
  const { createDb } = await import("../src/server/db/client");
  const { member, project } = await import("../src/server/db/schema");
  const { exportBoardPack } = await import("../src/server/services/board-pack");
  const { organization } = await import("../src/server/db/schema/auth");
  const db = createDb(process.env.DATABASE_URL!);
  try {
    const [p] = await db.select().from(project).where(eq(project.name, name));
    if (!p) throw new Error(`No project named "${name}".`);
    const [m] = await db.select().from(member).where(and(eq(member.organizationId, p.organizationId), eq(member.role, "owner")));
    const [org] = await db.select().from(organization).where(eq(organization.id, p.organizationId));
    const pack = await exportBoardPack({ db, userId: m!.userId, organization: org!, role: "owner" }, p.id);
    const json = JSON.stringify(pack);
    await mkdir(outDir, { recursive: true });
    const file = path.join(outDir, `${name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}.cutroom.json`);
    await writeFile(file, json);
    console.log(`✓ ${file} · ${(json.length / 1024).toFixed(0)} KB · ${pack.assets.length} files · ${pack.references.length} references`);
  } finally {
    await db.$client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
