import type { ReactNode } from "react";

type EditionSectionSurfaceProps = {
  embedded?: boolean;
  children: ReactNode;
  className?: string;
};

export function editionSectionSurfaceClass(embedded?: boolean, className?: string): string {
  const base = embedded
    ? ""
    : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
  return [base, className].filter(Boolean).join(" ");
}

export function EditionSectionSurface({
  embedded = false,
  children,
  className,
}: EditionSectionSurfaceProps) {
  return <div className={editionSectionSurfaceClass(embedded, className)}>{children}</div>;
}
