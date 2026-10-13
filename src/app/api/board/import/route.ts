import { NextResponse, type NextRequest } from "next/server";
import { AppError, toActionError } from "@/server/errors";
import { actionWorkspace } from "@/server/session";
import { importBoardPack } from "@/server/services/board-pack";

export const maxDuration = 60;

/** Creates a project from an uploaded board pack. Packs stay under Vercel's 4.5 MB request limit. */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const ctx = await actionWorkspace(String(form.get("slug") ?? ""));
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a .cutroom.json file.");
    if (file.size > 4_400_000) throw new AppError("VALIDATION", "That pack is over 4.4 MB. Export it with fewer or smaller images.");
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      throw new AppError("VALIDATION", "That file isn't valid JSON.");
    }
    const result = await importBoardPack(ctx, raw);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const res = toActionError(error);
    return NextResponse.json(res, { status: res.code === "UNAUTHENTICATED" ? 401 : res.code === "FORBIDDEN" ? 403 : 400 });
  }
}
