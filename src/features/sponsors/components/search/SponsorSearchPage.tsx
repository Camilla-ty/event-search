"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterPanel } from "./FilterPanel";
import { ResultsToolbar } from "./ResultsToolbar";
import { SponsorList } from "./SponsorList";
import type { FilterState, SponsorRecord } from "./types";

type SortValue = "tier" | "name";

type SponsorSearchPageProps = {
  sponsors: SponsorRecord[];
  initialFilters?: FilterState;
};

const defaultFilters: FilterState = {
  query: "",
  industry: "all",
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

export function SponsorSearchPage({
  sponsors,
  initialFilters,
}: SponsorSearchPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(initialFilters ?? defaultFilters);
  const [sort, setSort] = useState<SortValue>("tier");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const industries = useMemo(() => {
    const values = sponsors
      .map((sponsor) => sponsor.companies?.industry)
      .filter((industry): industry is string => Boolean(industry?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [sponsors]);

  const filteredAndSorted = useMemo(() => {
    const byFilter = sponsors.filter((sponsor) => {
      const name = normalizeText(sponsor.companies?.name);
      const industry = sponsor.companies?.industry ?? "";
      const query = normalizeText(filters.query);
      const queryMatch = !query || name.includes(query);
      const industryMatch = filters.industry === "all" || industry === filters.industry;
      return queryMatch && industryMatch;
    });

    return byFilter.sort((a, b) => {
      if (sort === "name") {
        return (a.companies?.name ?? "").localeCompare(b.companies?.name ?? "");
      }
      const ar = a.tier_rank ?? Number.POSITIVE_INFINITY;
      const br = b.tier_rank ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return (a.companies?.name ?? "").localeCompare(b.companies?.name ?? "");
    });
  }, [filters.industry, filters.query, sort, sponsors]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (filters.query.trim()) {
      next.set("q", filters.query.trim());
    } else {
      next.delete("q");
    }

    if (filters.industry !== "all") {
      next.set("industry", filters.industry);
    } else {
      next.delete("industry");
    }

    const current = searchParams.toString();
    const nextValue = next.toString();
    if (current !== nextValue) {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    }
  }, [filters, pathname, router, searchParams]);

  function handleReset() {
    setFilters(defaultFilters);
    setSort("tier");
    setPage(1);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Sponsor Search</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Find and connect with sponsors that fit your event.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <FilterPanel
            filters={filters}
            industries={industries}
            onChange={setFilters}
            onReset={handleReset}
            className="sticky top-6"
          />
        </div>

        <div className="space-y-4">
          <ResultsToolbar
            total={filteredAndSorted.length}
            sort={sort}
            onSortChange={setSort}
            onOpenFilters={() => setMobileFiltersOpen(true)}
          />
          <SponsorList
            sponsors={filteredAndSorted}
            loading={false}
            onReset={handleReset}
            page={page}
            onPageChange={setPage}
          />
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-[88%] max-w-sm overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
              <button
                type="button"
                className="text-sm text-slate-500 dark:text-slate-300"
                onClick={() => setMobileFiltersOpen(false)}
              >
                Close
              </button>
            </div>
            <FilterPanel filters={filters} industries={industries} onChange={setFilters} onReset={handleReset} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
