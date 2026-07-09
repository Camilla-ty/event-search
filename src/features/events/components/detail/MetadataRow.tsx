import type { ReactNode } from "react";

type MetadataRowProps = {
  label: string;
  labelSuffix?: ReactNode;
  children: ReactNode;
};

export function MetadataRow({ label, labelSuffix, children }: MetadataRowProps) {
  return (
    <div className="flex min-h-12 flex-col justify-center gap-0.5 sm:flex-row sm:items-center sm:gap-4">
      <dt className="shrink-0 text-sm font-medium text-slate-700 sm:w-36">
        <span className="inline-flex items-center gap-1.5">
          {label}
          {labelSuffix}
        </span>
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-600">{children}</dd>
    </div>
  );
}
