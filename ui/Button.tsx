import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary" | "ghost";

const variants: Record<Variant, string> = {
  default: "btn",
  primary: "btn btn-primary",
  ghost: "btn btn-ghost",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "default", className, ...props }: ButtonProps) {
  return <button className={clsx(variants[variant], className)} {...props} />;
}
