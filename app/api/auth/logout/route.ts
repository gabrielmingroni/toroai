import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mockStore } from "@/lib/auth/mock-store";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  mockStore.destroySession(token);
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
