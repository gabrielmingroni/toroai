import { NextResponse } from "next/server";
import { mockStore } from "@/lib/auth/mock-store";
import type { ForgotPasswordRequest } from "@/lib/auth/types";

export async function POST(req: Request) {
  const body = (await req.json()) as ForgotPasswordRequest;
  if (!body?.email) {
    return NextResponse.json({ ok: false, error: { code: "missing_fields", message: "Email required.", field: "email" } }, { status: 400 });
  }
  const user = mockStore.findUser(body.email);
  // Always respond OK to avoid leaking which emails exist
  let devLink: string | undefined;
  if (user) {
    const token = mockStore.createResetToken(user.email);
    devLink = `/auth/reset-password?token=${token}`;
    // In real backend: send email here.
    console.log(`[ToroAI/mock] Password reset for ${user.email}: ${devLink}`);
  }
  return NextResponse.json({ ok: true, devLink });
}
