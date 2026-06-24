"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/client";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { FieldError } from "@/components/auth/FieldError";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/projects";

  const [email, setEmail] = useState("joseph@phoenixisg.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    startTransition(async () => {
      const res = await auth.login({ email, password, remember });
      if (!res.ok) {
        if (res.error?.field) setFieldErrors({ [res.error.field]: res.error.message });
        else setError(res.error?.message || "Sign in failed.");
        return;
      }
      router.push(returnTo);
      router.refresh();
    });
  }

  function demoSignIn() {
    setError(null); setFieldErrors({});
    setEmail("joseph@phoenixisg.com");
    setPassword("torres1234");
    startTransition(async () => {
      const res = await auth.login({
        email: "joseph@phoenixisg.com",
        password: "torres1234",
        remember: true,
      });
      if (!res.ok) {
        setError(res.error?.message || "Demo sign-in failed.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <>
      <AuthHeader title="Sign in" subtitle="Continue to your ICT design workspace." />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required
            className="input"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com" />
          <FieldError message={fieldErrors.email} />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="field-label" htmlFor="password">Password</label>
            <Link href="/auth/forgot-password" className="text-[11px] text-text3 hover:text-accent transition-colors">
              Forgot?
            </Link>
          </div>
          <input id="password" type="password" autoComplete="current-password" required
            className="input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <FieldError message={fieldErrors.password} />
        </div>

        <label className="flex items-center gap-2 text-[12px] text-text2 select-none cursor-pointer">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            className="w-3.5 h-3.5 accent-accent" />
          Keep me signed in for 30 days
        </label>

        {error && (
          <div className="text-[12px] text-fail bg-fail/10 border border-fail/30 rounded-[2px] px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" disabled={pending}
          className="btn btn-primary justify-center py-2.5 text-[13px] font-medium disabled:opacity-60 disabled:cursor-wait">
          {pending ? "Signing in…" : "Sign in"}
        </button>

        <div className="text-center text-[12px] text-text3 mt-2">
          No account?{" "}
          <Link href="/auth/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-chrome-dark">
          <button type="button" onClick={demoSignIn} disabled={pending}
                  className="w-full border border-accent/40 bg-accent/5 text-accent hover:bg-accent/10 transition-colors py-2 text-[12px] font-medium rounded-[2px] inline-flex items-center justify-center gap-2">
            <i className="ti ti-user" style={{ fontSize: 13 }} aria-hidden="true" />
            Sign in with demo account
          </button>
          <div className="mt-2 text-[10px] text-text4 font-mono text-center">
            Demo credentials: joseph@phoenixisg.com / torres1234
          </div>
        </div>
      </form>
    </>
  );
}
