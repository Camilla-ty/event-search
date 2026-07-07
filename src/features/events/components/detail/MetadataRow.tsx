import type { ReactNode } from "react";

type MetadataRowProps = {
  label: string;
  children: ReactNode;
};

export function MetadataRow({ label, children }: MetadataRowProps) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm font-medium text-slate-700 sm:w-36">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-600">{children}</dd>
    </div>
  );
}
