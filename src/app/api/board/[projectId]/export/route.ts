import { NextResponse, type NextRequest } from "next/server";
import { toActionError } from "@/server/errors";
import { actionWorkspace } from "@/server/session";
import { exportBoardPack } from "@/server/services/board-pack";

/** Downloads a project's board as a portable board pack (.cutroom.json). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const ctx = await actionWorkspace(request.nextUrl.searchParams.get("slug") ?? "");
    const pack = await exportBoardPack(ctx, projectId);
    const file = `${pack.project.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "board"}.cutroom.json`;
    return new NextResponse(JSON.stringify(pack), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store" },
    });
  } catch (error) {
    const res = toActionError(error);
    return NextResponse.json(res, { status: res.code === "UNAUTHENTICATED" ? 401 : res.code === "NOT_FOUND" ? 404 : 400 });
  }
}
