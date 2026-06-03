"use client";

import type { ReactNode } from "react";

import { filterPanelAsideClass } from "./filterStyles";

type FilterPanelShellProps = {
  children: ReactNode;
  onReset: () => void;
  className?: string;
};

export function FilterPanelShell({
  children,
  onReset,
  className,
}: FilterPanelShellProps) {
  return (
    <aside
      className={[filterPanelAsideClass, className].filter(Boolean).join(" ")}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-brand-primary hover:text-brand-primary-hover"
        >
          Clear all
        </button>
      </div>
      <div className="space-y-4">{children}</div>
    </aside>
  );
}
