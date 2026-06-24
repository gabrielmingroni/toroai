/**
 * Auth client — calls Next.js /api/auth/* routes which mock the eventual
 * FastAPI shape. When the real backend lands, point this at FASTAPI_URL
 * by changing the base URL only — the function signatures stay stable.
 */
import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "./types";

const BASE = "/api/auth";

async function post<T>(path: string, body: T): Promise<AuthResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || { code: "unknown", message: "Request failed" } };
  }
  return data;
}

export const auth = {
  login:    (req: LoginRequest)          => post("/login", req),
  signup:   (req: SignupRequest)         => post("/signup", req),
  forgot:   (req: ForgotPasswordRequest) => post("/forgot", req),
  reset:    (req: ResetPasswordRequest)  => post("/reset", req),
  logout:   () => fetch(`${BASE}/logout`, { method: "POST", credentials: "include" }),
  async me(): Promise<AuthResponse> {
    const res = await fetch(`${BASE}/me`, { credentials: "include" });
    if (!res.ok) return { ok: false, error: { code: "unauthenticated", message: "Not signed in" } };
    return res.json();
  },
};
