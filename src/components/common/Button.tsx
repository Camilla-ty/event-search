import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-white hover:bg-brand-primary-hover focus-visible:ring-brand-primary/40",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const composedClassName = [
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={composedClassName}
      {...props}
      type={type}
    />
  );
}
