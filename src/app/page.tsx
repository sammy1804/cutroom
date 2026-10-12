import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getSession } from "@/server/session";
import { listWorkspacesForUser } from "@/server/services/workspaces";

/** Entry point: send people to their first workspace, onboarding, or sign-in. */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const [first] = await listWorkspacesForUser(db, session.user.id);
  redirect(first ? `/w/${first.slug}` : "/onboarding");
}
