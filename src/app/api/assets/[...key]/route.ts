import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/server/auth/server";
import { db } from "@/server/db";
import { member } from "@/server/db/schema";
import { getProvider } from "@/server/providers/registry";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", mp3: "audio/mpeg" };

/** Serves stored files. Keys start with the organization id; only its members can read them. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const parts = (await params).key.map(decodeURIComponent);
  const key = parts.join("/");
  const [orgId] = key.split("/");
  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId!), eq(member.userId, session.user.id)));
  if (!membership) return new NextResponse("Not found", { status: 404 });

  const body = await getProvider("storage").get(key).catch(() => null);
  if (!body) return new NextResponse("Not found", { status: 404 });
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(Buffer.from(body), {
    headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" },
  });
}
