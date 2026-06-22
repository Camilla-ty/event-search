"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchBar } from "@/src/components/common";
import {
  buildEventExplorerUrl,
  buildSponsorSearchUrl,
} from "@/src/lib/routes/explorerUrls";

export type GlobalSearchScope = "sponsors" | "events";

function scopeForPathname(pathname: string): GlobalSearchScope {
  if (pathname === "/events" || pathname.startsWith("/events/")) {
    return "events";
  }
  return "sponsors";
}

export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [scope, setScope] = useState<GlobalSearchScope>(() => scopeForPathname(pathname));

  useEffect(() => {
    setScope(scopeForPathname(pathname));
  }, [pathname]);

  function handleSearch(query: string) {
    const target =
      scope === "events" ? buildEventExplorerUrl(query) : buildSponsorSearchUrl(query);
    router.push(target);
  }

  return (
    <div className={className}>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Global search
      </p>
      <div
        className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        role="tablist"
        aria-label="Search scope"
      >
        <button
          type="button"
          role="tab"
          aria-selected={scope === "sponsors"}
          onClick={() => setScope("sponsors")}
          className={[
            "rounded-md px-3 py-1.5 text-xs font-medium transition",
            scope === "sponsors"
              ? "bg-brand-primary text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          ].join(" ")}
        >
          Sponsors
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "events"}
          onClick={() => setScope("events")}
          className={[
            "rounded-md px-3 py-1.5 text-xs font-medium transition",
            scope === "events"
              ? "bg-brand-primary text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          ].join(" ")}
        >
          Events
        </button>
      </div>
      <SearchBar
        ariaLabel={
          scope === "events"
            ? "Search events by name, series, or location"
            : "Search sponsoring companies globally"
        }
        placeholder={
          scope === "events"
            ? "Search events by name, series, or location…"
            : "Search sponsoring companies…"
        }
        onSearch={handleSearch}
        className="min-w-0 w-full"
        submitVariant="secondary"
      />
    </div>
  );
}
