import { NextResponse } from "next/server";
import { mockStore, publicUser } from "@/lib/auth/mock-store";
import { setSessionCookie } from "@/lib/auth/session";
import type { LoginRequest } from "@/lib/auth/types";

export async function POST(req: Request) {
  const body = (await req.json()) as LoginRequest;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ ok: false, error: { code: "missing_fields", message: "Email and password are required.", field: !body?.email ? "email" : "password" } }, { status: 400 });
  }
  const user = mockStore.findUser(body.email);
  if (!user || !mockStore.verifyPassword(user, body.password)) {
    return NextResponse.json({ ok: false, error: { code: "invalid_credentials", message: "Email or password is incorrect." } }, { status: 401 });
  }
  const token = mockStore.createSession(user.email);
  setSessionCookie(token, body.remember ?? false);
  return NextResponse.json({ ok: true, user: publicUser(user) });
}
