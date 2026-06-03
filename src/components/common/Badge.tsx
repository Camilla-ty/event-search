import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "neutral" | "success" | "warning" | "accent";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-brand-primary-muted text-brand-primary",
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-brand-success/15 text-brand-success",
  warning: "bg-brand-warning/20 text-amber-900",
  accent: "bg-brand-accent/10 text-brand-accent",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
