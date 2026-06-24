import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { projectStore } from "@/lib/projects/mock-store";
import { detectRoomsFromImage } from "@/lib/intake/vision-room-detect";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10 MB after base64 decode

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const project = projectStore.get(params.id, user.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found." } }, { status: 404 });
  }

  let body: { imageBase64?: string; mediaType?: string; floor?: number; pageLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      ok: false,
      error: { code: "bad_json", message: "Request body must be JSON with imageBase64 + mediaType." },
    }, { status: 400 });
  }
  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return NextResponse.json({
      ok: false,
      error: { code: "no_image", message: "imageBase64 is required." },
    }, { status: 400 });
  }
  // Rough size sanity — base64 is ~4/3 the byte count.
  if (body.imageBase64.length > (MAX_IMAGE_BYTES * 4) / 3) {
    return NextResponse.json({
      ok: false,
      error: { code: "image_too_large", message: "Image exceeds 10 MB after decode." },
    }, { status: 413 });
  }

  try {
    const result = await detectRoomsFromImage({
      imageBase64: body.imageBase64,
      mediaType: (body.mediaType === "image/jpeg" ? "image/jpeg" : "image/png"),
      floor: typeof body.floor === "number" ? body.floor : 1,
      pageLabel: body.pageLabel,
    });
    return NextResponse.json({
      ok: true,
      detected: result.detected,
      rooms: result.rooms,
      tokens: result.tokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: { code: "detection_failed", message: msg },
    }, { status: 502 });
  }
}
