import clsx from "clsx";
import type { ReactNode } from "react";

type TagVariant = "pass" | "warn" | "fail" | "info";

const variants: Record<TagVariant, string> = {
  pass: "tag-pass",
  warn: "tag-warn",
  fail: "tag-fail",
  info: "tag-info",
};

export function Tag({
  children,
  variant,
  className,
}: {
  children: ReactNode;
  variant: TagVariant;
  className?: string;
}) {
  return <span className={clsx("tag", variants[variant], className)}>{children}</span>;
}
