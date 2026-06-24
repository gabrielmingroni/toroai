"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { FieldError } from "@/components/auth/FieldError";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!token) {
    return (
      <>
        <AuthHeader title="Invalid reset link" subtitle="The link is missing a token. Request a new one." />
        <Link href="/auth/forgot-password" className="btn btn-primary justify-center py-2.5">Request new link</Link>
      </>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    if (newPassword !== confirm) {
      setFieldErrors({ confirm: "Passwords don't match." });
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      }).then(r => r.json());
      if (!res.ok) {
        if (res.error?.field) setFieldErrors({ [res.error.field]: res.error.message });
        else setError(res.error?.message || "Reset failed.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 1500);
    });
  }

  if (success) {
    return (
      <>
        <AuthHeader title="Password updated" subtitle="Redirecting you to sign in…" />
      </>
    );
  }

  return (
    <>
      <AuthHeader title="Set a new password" subtitle="Pick something you'll remember. Eight characters minimum." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="newPassword">New password</label>
          <input id="newPassword" type="password" required autoComplete="new-password" className="input"
            value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
          <FieldError message={fieldErrors.newPassword} />
        </div>
        <div>
          <label className="field-label" htmlFor="confirm">Confirm</label>
          <input id="confirm" type="password" required autoComplete="new-password" className="input"
            value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
          <FieldError message={fieldErrors.confirm} />
        </div>
        {error && (
          <div className="text-[12px] text-fail bg-fail/10 border border-fail/30 rounded-[2px] px-3 py-2">{error}</div>
        )}
        <button type="submit" disabled={pending}
          className="btn btn-primary justify-center py-2.5 text-[13px] font-medium disabled:opacity-60 disabled:cursor-wait">
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </>
  );
}
