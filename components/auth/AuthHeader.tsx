export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      {/* Compact brand mark for narrow viewports where splash is hidden */}
      <div className="lg:hidden flex items-baseline gap-1 mb-6">
        <span className="text-[22px] font-semibold tracking-tight">Toro</span>
        <span className="text-[22px] font-semibold tracking-tight text-accent">AI</span>
      </div>
      <h1 className="text-[20px] font-semibold text-text mb-1">{title}</h1>
      {subtitle && <p className="text-[12px] text-text3">{subtitle}</p>}
    </header>
  );
}
