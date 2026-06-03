"use client";

import type { ReactNode } from "react";

import { filterLabelClass } from "./filterStyles";

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className={filterLabelClass}>{label}</span>
      {children}
    </label>
  );
}
