"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/client";
import type { AuthRole } from "@/lib/auth/types";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { FieldError } from "@/components/auth/FieldError";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [role,      setRole]      = useState<AuthRole>("rcdd");
  const [rcddNumber, setRcddNumber] = useState("");
  const [rcddState,  setRcddState]  = useState("TX");
  const [firmName,   setFirmName]   = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({});
    startTransition(async () => {
      const res = await auth.signup({
        firstName, lastName, email, password, role,
        rcddNumber: role === "rcdd" ? rcddNumber : undefined,
        rcddState:  role === "rcdd" ? rcddState  : undefined,
        firmName,
      });
      if (!res.ok) {
        if (res.error?.field) setFieldErrors({ [res.error.field]: res.error.message });
        else setError(res.error?.message || "Sign up failed.");
        return;
      }
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <>
      <AuthHeader title="Create your account" subtitle="Designs are stamped against your RCDD credentials — enter them accurately." />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="firstName">First name</label>
            <input id="firstName" className="input" required
              value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="lastName">Last name</label>
            <input id="lastName" className="input" required
              value={lastName} onChange={(e)=>setLastName(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="email">Work email</label>
          <input id="email" type="email" autoComplete="email" required className="input"
            value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@firm.com" />
          <FieldError message={fieldErrors.email} />
        </div>

        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" required className="input"
            value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="8+ characters" />
          <FieldError message={fieldErrors.password} />
        </div>

        <div>
          <label className="field-label" htmlFor="role">Role</label>
          <select id="role" className="input" value={role} onChange={(e)=>setRole(e.target.value as AuthRole)}>
            <option value="rcdd">RCDD (stamping designer)</option>
            <option value="designer">Designer (non-stamping)</option>
            <option value="admin">Firm admin</option>
            <option value="viewer">Viewer (read-only)</option>
          </select>
        </div>

        {role === "rcdd" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="field-label" htmlFor="rcddNumber">RCDD number</label>
              <input id="rcddNumber" className="input"
                value={rcddNumber} onChange={(e)=>setRcddNumber(e.target.value)} placeholder="12847" />
              <FieldError message={fieldErrors.rcddNumber} />
            </div>
            <div>
              <label className="field-label" htmlFor="rcddState">State</label>
              <select id="rcddState" className="input" value={rcddState} onChange={(e)=>setRcddState(e.target.value)}>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="firmName">Firm name <span className="text-text4 normal-case font-normal">(optional)</span></label>
          <input id="firmName" className="input"
            value={firmName} onChange={(e)=>setFirmName(e.target.value)} placeholder="Phoenix Infrastructure Services Group" />
        </div>

        {error && (
          <div className="text-[12px] text-fail bg-fail/10 border border-fail/30 rounded-[2px] px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" disabled={pending}
          className="btn btn-primary justify-center py-2.5 text-[13px] font-medium disabled:opacity-60 disabled:cursor-wait">
          {pending ? "Creating account…" : "Create account"}
        </button>

        <div className="text-center text-[12px] text-text3 mt-2">
          Already have one?{" "}
          <Link href="/auth/login" className="text-accent hover:underline">Sign in</Link>
        </div>

        <div className="mt-2 text-[10.5px] text-text4 leading-relaxed">
          By creating an account you confirm your RCDD credentials are valid and accept that ToroAI deliverables are signed and stamped under your responsibility per BICSI § 1.3.
        </div>
      </form>
    </>
  );
}
