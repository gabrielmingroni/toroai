// Status bar — bottom strip. Coordinates, scale, snap, save state, active
// tool hint. Each segment is rendered as a discrete chunk so the user
// reads it left-to-right like a CAD status line.

import clsx from "clsx";

export interface StatusSegment {
  kind?: "coord" | "info" | "warn" | "pass" | "neutral";
  /** Optional tabler icon class without "ti ". */
  icon?: string;
  text: string;
}

export function StatusBar({
  segments, trailing,
}: {
  segments: StatusSegment[];
  /** Right-aligned trailing segments (e.g. active tool + hint). */
  trailing?: StatusSegment[];
}) {
  return (
    <div className="h-[22px] bg-chrome-dark border-t border-chrome-darkest flex items-center text-[10.5px] text-text3 font-sans px-3 gap-3">
      {segments.map((s, i) => <Segment key={i} seg={s} />)}
      {trailing && (
        <>
          <div className="ml-auto flex items-center gap-3">
            {trailing.map((s, i) => <Segment key={i} seg={s} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Segment({ seg }: { seg: StatusSegment }) {
  const cls =
    seg.kind === "coord" ? "font-mono tabular-nums text-text2"
    : seg.kind === "info"  ? "text-info"
    : seg.kind === "warn"  ? "text-warn"
    : seg.kind === "pass"  ? "text-pass"
    : "text-text3";
  return (
    <span className={clsx("inline-flex items-center gap-1", cls)}>
      {seg.icon && <i className={"ti " + seg.icon} style={{ fontSize: 11 }} aria-hidden="true" />}
      <span>{seg.text}</span>
    </span>
  );
}
