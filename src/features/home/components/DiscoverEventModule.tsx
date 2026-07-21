import Link from "next/link";
import type { ReactNode } from "react";

import { brandLinkClass } from "@/src/lib/design/classes";

type DiscoverEventModuleProps = {
  title: string;
  description: string;
  viewAllHref: string;
  viewAllLabel?: string;
  emptyMessage: string;
  emptyActionHref: string;
  emptyActionLabel?: string;
  isEmpty: boolean;
  fillHeight?: boolean;
  children: ReactNode;
};

export function DiscoverEventModule({
  title,
  description,
  viewAllHref,
  viewAllLabel = "View all",
  emptyMessage,
  emptyActionHref,
  emptyActionLabel = "Browse all events",
  isEmpty,
  fillHeight = false,
  children,
}: DiscoverEventModuleProps) {
  return (
    <section className={`space-y-3 ${fillHeight ? "flex h-full flex-1 flex-col" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <Link href={viewAllHref} className={`text-sm ${brandLinkClass}`}>
          {viewAllLabel}
        </Link>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p>{emptyMessage}</p>
          <Link href={emptyActionHref} className={`mt-3 inline-block ${brandLinkClass}`}>
            {emptyActionLabel} →
          </Link>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
