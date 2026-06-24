import { NextResponse } from "next/server";
import { mockStore } from "@/lib/auth/mock-store";
import type { ResetPasswordRequest } from "@/lib/auth/types";

export async function POST(req: Request) {
  const body = (await req.json()) as ResetPasswordRequest;
  if (!body?.token || !body?.newPassword) {
    return NextResponse.json({ ok: false, error: { code: "missing_fields", message: "Token and new password required." } }, { status: 400 });
  }
  if (body.newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: { code: "weak_password", message: "Password must be at least 8 characters.", field: "newPassword" } }, { status: 400 });
  }
  const email = mockStore.consumeResetToken(body.token);
  if (!email) {
    return NextResponse.json({ ok: false, error: { code: "invalid_token", message: "Reset link expired or already used." } }, { status: 400 });
  }
  const user = mockStore.findUser(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "no_user", message: "Account not found." } }, { status: 404 });
  }
  mockStore.setPassword(user, body.newPassword);
  return NextResponse.json({ ok: true });
}
