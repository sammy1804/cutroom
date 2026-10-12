/**
 * Creates a demo account with a workspace, a project and a campaign.
 * Idempotent: re-running skips anything that already exists.
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export const DEMO_USER = {
  name: "Demo Producer",
  email: "demo@cutroom.test",
  password: "cutroom-demo-1",
};

async function main() {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database: the demo password is public.");
  }
  const { createAuth } = await import("../src/server/auth");
  const { createDb } = await import("../src/server/db/client");
  const { user } = await import("../src/server/db/schema");
  const { createWorkspace, findMembership, listWorkspacesForUser } = await import("../src/server/services/workspaces");
  const { createProject, listProjects } = await import("../src/server/services/projects");
  const { createCampaign } = await import("../src/server/services/campaigns");

  const db = createDb(process.env.DATABASE_URL!);
  const auth = createAuth({ db, secret: process.env.BETTER_AUTH_SECRET!, baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000" });

  try {
    let [existing] = await db.select().from(user).where(eq(user.email, DEMO_USER.email));
    if (!existing) {
      await auth.api.signUpEmail({ body: DEMO_USER });
      [existing] = await db.select().from(user).where(eq(user.email, DEMO_USER.email));
      console.log(`✓ created ${DEMO_USER.email}`);
    }
    const userId = existing!.id;

    let [workspace] = await listWorkspacesForUser(db, userId);
    if (!workspace) {
      const created = await createWorkspace(auth, db, userId, { name: "Northlight Studio" });
      workspace = { ...created, logo: null, role: "owner" };
      console.log(`✓ created workspace /w/${created.slug}`);
    }

    const membership = (await findMembership(db, userId, workspace.slug))!;
    const ctx = { db, userId, organization: membership.organization, role: membership.role };
    if ((await listProjects(ctx)).length === 0) {
      const project = await createProject(ctx, {
        name: "Halden Coffee Roasters",
        description: "Specialty roaster with a DTC subscription. Warm, slightly nerdy tone.",
        websiteUrl: "haldencoffee.com",
      });
      await createCampaign(ctx, project.id, {
        name: "Autumn single-origin drop",
        objective: "launch",
        brief: "Launch three limited single-origin coffees. Show the farm-to-cup story in under 20 seconds and drive subscription sign-ups.",
        audience: "Home brewers, 25–40, already buy specialty beans",
        channels: ["instagram_reels", "tiktok", "youtube_shorts"],
        aspectRatios: ["9:16", "1:1"],
      });
      console.log("✓ created demo project and campaign");
    }
    console.log(`\nSign in at ${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/sign-in with the DEMO_USER in scripts/seed.ts`);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
