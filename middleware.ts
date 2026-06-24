import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Edge middleware — does a *coarse* auth check based on cookie presence.
 * Authoritative validation happens in server components / route handlers
 * (which run in the Node runtime and can hit the session store).
 *
 * If you visit a protected route without a cookie, you bounce to /auth/login
 * with ?returnTo set so we can deep-link back after sign in.
 */

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const PUBLIC_PREFIXES = [
  "/api/auth/", // login/signup/me/etc.
  "/_next/",
  "/favicon",
  "/fonts/",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    if (pathname !== "/") url.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except static asset files
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
