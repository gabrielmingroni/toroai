// Server-side session helpers — used by /api/auth/* route handlers and (app) layout.
// The Edge middleware does NOT import this file; it pulls SESSION_COOKIE
// directly from ./constants so the mock-store + Node crypto don't leak into Edge bundles.
import { cookies } from "next/headers";
import { mockStore, publicUser } from "./mock-store";
import type { AuthUser } from "./types";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./constants";

export { SESSION_COOKIE, SESSION_MAX_AGE };

export function setSessionCookie(token: string, remember: boolean) {
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? SESSION_MAX_AGE : undefined, // session cookie if !remember
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export function getCurrentUser(): AuthUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const u = mockStore.getSessionUser(token);
  return u ? publicUser(u) : null;
}
