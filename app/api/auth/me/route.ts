import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Not signed in." } }, { status: 401 });
  }
  return NextResponse.json({ ok: true, user });
}
