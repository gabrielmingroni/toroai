"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth/client";
import { AuthHeader } from "@/components/auth/AuthHeader";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then(r => r.json());
      setSent(true);
      setDevLink(res.devLink);
    });
  }

  if (sent) {
    return (
      <>
        <AuthHeader title="Check your email" subtitle={`If an account exists for ${email}, we sent a reset link.`} />
        {devLink && (
          <div className="border border-accent/30 bg-accent/5 rounded-[2px] px-3 py-3 text-[11px] text-text2 font-mono leading-relaxed">
            <div className="text-accent uppercase tracking-[0.06em] text-[9.5px] mb-1">Dev preview · the real backend will email this</div>
            <Link href={devLink} className="text-accent hover:underline break-all">{devLink}</Link>
          </div>
        )}
        <div className="mt-6 text-center text-[12px] text-text3">
          <Link href="/auth/login" className="text-accent hover:underline">Back to sign in</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeader title="Reset your password" subtitle="Enter your email and we'll send a reset link." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input"
            value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@firm.com" />
        </div>
        <button type="submit" disabled={pending}
          className="btn btn-primary justify-center py-2.5 text-[13px] font-medium disabled:opacity-60 disabled:cursor-wait">
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <div className="text-center text-[12px] text-text3 mt-2">
          <Link href="/auth/login" className="text-accent hover:underline">Back to sign in</Link>
        </div>
      </form>
    </>
  );
}
