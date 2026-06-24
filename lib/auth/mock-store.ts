/**
 * Mock auth store — in-memory user + session storage that stands in for
 * FastAPI + Postgres during frontend development. Restart-resets are fine
 * for now. When real backend is wired, this file gets deleted.
 *
 * NOTE: a single demo account is seeded so you can log in immediately.
 *   email:    joseph@phoenixisg.com
 *   password: torres1234
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { AuthUser } from "./types";

type StoredUser = AuthUser & { passwordHash: string; salt: string };

// Persist the in-memory state across Next.js dev-mode HMR module reloads.
// Without this, hot reloads wipe the sessions Map while browser cookies remain,
// leaving users with a "logged in" cookie pointing at a session that no longer
// exists — which crashes server components calling getCurrentUser()!.
const g = globalThis as unknown as {
  __toroaiAuth?: {
    users:       Map<string, StoredUser>;
    sessions:    Map<string, string>;
    resetTokens: Map<string, string>;
  };
};
if (!g.__toroaiAuth) {
  g.__toroaiAuth = {
    users:       new Map<string, StoredUser>(),
    sessions:    new Map<string, string>(),
    resetTokens: new Map<string, string>(),
  };
}
const users       = g.__toroaiAuth.users;
const sessions    = g.__toroaiAuth.sessions;
const resetTokens = g.__toroaiAuth.resetTokens;

function hash(pw: string, salt: string) {
  return scryptSync(pw, salt, 64).toString("hex");
}

function seedIfEmpty() {
  if (users.size > 0) return;
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hash("torres1234", salt);
  const seed: StoredUser = {
    id: "u_001",
    email: "joseph@phoenixisg.com",
    firstName: "Joseph",
    lastName: "Torres",
    rcddNumber: "12847",
    rcddState: "TX",
    rcddExpiry: "2028-06-30",
    role: "rcdd",
    firmName: "Phoenix Infrastructure Services Group",
    firmAddress: "1200 Smith St, Suite 1600",
    firmCity: "Houston",
    firmState: "TX",
    whiteLabel: false,
    tier: "rcdd",
    designsUsedThisMonth: 3,
    designsLimit: 10,
    emailVerified: true,
    createdAt: "2025-09-12T14:22:00Z",
    passwordHash,
    salt,
  };
  users.set(seed.email.toLowerCase(), seed);
}
seedIfEmpty();

export const mockStore = {
  findUser(email: string): StoredUser | undefined {
    return users.get(email.toLowerCase());
  },
  createUser(u: Omit<StoredUser, "passwordHash" | "salt"> & { password: string }): StoredUser {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = hash(u.password, salt);
    const { password, ...rest } = u;
    const stored: StoredUser = { ...rest, passwordHash, salt };
    users.set(stored.email.toLowerCase(), stored);
    return stored;
  },
  verifyPassword(user: StoredUser, password: string): boolean {
    const candidate = hash(password, user.salt);
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(user.passwordHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },
  setPassword(user: StoredUser, newPassword: string) {
    user.salt = randomBytes(16).toString("hex");
    user.passwordHash = hash(newPassword, user.salt);
  },
  createSession(email: string): string {
    const token = randomBytes(32).toString("hex");
    sessions.set(token, email.toLowerCase());
    return token;
  },
  getSessionUser(token: string | undefined): StoredUser | undefined {
    if (!token) return undefined;
    const email = sessions.get(token);
    if (!email) return undefined;
    return users.get(email);
  },
  destroySession(token: string | undefined) {
    if (token) sessions.delete(token);
  },
  createResetToken(email: string): string {
    const token = randomBytes(24).toString("hex");
    resetTokens.set(token, email.toLowerCase());
    return token;
  },
  consumeResetToken(token: string): string | undefined {
    const email = resetTokens.get(token);
    if (email) resetTokens.delete(token);
    return email;
  },
};

export function publicUser(u: StoredUser): AuthUser {
  const { passwordHash, salt, ...pub } = u;
  return pub;
}
