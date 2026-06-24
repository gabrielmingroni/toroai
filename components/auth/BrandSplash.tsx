// Left-side splash for /auth/* pages. Subtle technical grid + brand mark.
// Hidden on narrow viewports.

export function BrandSplash() {
  return (
    <aside className="hidden lg:flex flex-col w-[420px] bg-chrome border-r border-chrome-dark relative overflow-hidden">
      {/* Subtle grid background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="splashGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#34373d" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#splashGrid)" />
      </svg>

      <div className="relative z-10 p-10 flex flex-col h-full">
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-semibold tracking-tight">Toro</span>
          <span className="text-[28px] font-semibold tracking-tight text-accent">AI</span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-text4">
          ICT Design Workspace
        </div>

        <div className="mt-auto">
          <div className="text-[14px] text-text leading-relaxed mb-4">
            Standards-grade ICT design at the speed of an RCDD's intuition.
          </div>
          <div className="font-mono text-[10px] text-text3 leading-relaxed">
            BICSI TDMM 15 · TIA-568.1-D · TIA-569-D · TIA-607-C · NEC 800 · IEEE 802.3bt
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-chrome-dark text-[10.5px] text-text4 font-mono">
          Phoenix Infrastructure Services Group
        </div>
      </div>
    </aside>
  );
}
