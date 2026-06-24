import { NextResponse } from "next/server";
import { mockStore, publicUser } from "@/lib/auth/mock-store";
import { setSessionCookie } from "@/lib/auth/session";
import type { SignupRequest } from "@/lib/auth/types";

export async function POST(req: Request) {
  const body = (await req.json()) as SignupRequest;
  const required: (keyof SignupRequest)[] = ["email", "password", "firstName", "lastName", "role"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ ok: false, error: { code: "missing_fields", message: `Field "${field}" is required.`, field } }, { status: 400 });
    }
  }

  if (body.password.length < 8) {
    return NextResponse.json({ ok: false, error: { code: "weak_password", message: "Password must be at least 8 characters.", field: "password" } }, { status: 400 });
  }

  // RCDD role requires an RCDD number
  if (body.role === "rcdd" && !body.rcddNumber) {
    return NextResponse.json({ ok: false, error: { code: "missing_rcdd", message: "RCDD number is required for RCDD role.", field: "rcddNumber" } }, { status: 400 });
  }

  if (mockStore.findUser(body.email)) {
    return NextResponse.json({ ok: false, error: { code: "email_taken", message: "An account with this email already exists.", field: "email" } }, { status: 409 });
  }

  const id = "u_" + Math.random().toString(36).slice(2, 10);
  const created = mockStore.createUser({
    id,
    email: body.email,
    password: body.password,
    firstName: body.firstName,
    lastName: body.lastName,
    role: body.role,
    rcddNumber: body.rcddNumber || null,
    rcddState: body.rcddState || null,
    rcddExpiry: null,
    firmName: body.firmName || null,
    firmAddress: null,
    firmCity: null,
    firmState: null,
    whiteLabel: false,
    tier: body.tier ?? "starter",
    designsUsedThisMonth: 0,
    designsLimit: 5,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  });

  const token = mockStore.createSession(created.email);
  setSessionCookie(token, true);
  return NextResponse.json({ ok: true, user: publicUser(created) }, { status: 201 });
}
