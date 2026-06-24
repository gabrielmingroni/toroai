import type { ReactNode } from "react";

export function ParameterSection({ title, cite, children }: { title: string; cite?: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-header flex-col items-start py-2.5">
        <div className="card-title">{title}</div>
        {cite && <div className="text-[10px] text-text4 font-mono normal-case tracking-normal mt-0.5">{cite}</div>}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
