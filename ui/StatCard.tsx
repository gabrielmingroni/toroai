import clsx from "clsx";

type StatColor = "accent" | "pass" | "warn" | "fail" | "info" | "neutral";

const valueColor: Record<StatColor, string> = {
  accent: "text-accent",
  pass:   "text-pass",
  warn:   "text-warn",
  fail:   "text-fail",
  info:   "text-info",
  neutral:"text-text",
};

export function StatCard({
  label,
  value,
  sub,
  color = "accent",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: StatColor;
}) {
  return (
    <div className="bg-chrome-dark border border-chrome-dark rounded-[2px] p-3.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-text3 font-mono">{label}</div>
      <div className={clsx("mt-1 text-[22px] font-semibold tabular-nums", valueColor[color])}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10.5px] text-text4 font-mono">{sub}</div> : null}
    </div>
  );
}
