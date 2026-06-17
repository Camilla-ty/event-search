"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { CompanyListFilter } from "@/src/features/companies/server/companyAdmin";
import { formInputClass } from "@/src/lib/design/classes";

type AdminCompaniesSearchFormProps = {
  filter: CompanyListFilter;
  initialSearch: string;
};

function buildCompaniesListPath(filter: CompanyListFilter, search: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  const trimmed = search.trim();
  if (trimmed !== "") params.set("search", trimmed);
  const query = params.toString();
  return query ? `/admin/companies?${query}` : "/admin/companies";
}

export function AdminCompaniesSearchForm({
  filter,
  initialSearch,
}: AdminCompaniesSearchFormProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildCompaniesListPath(filter, search));
  }

  function handleClear() {
    setSearch("");
    router.push(buildCompaniesListPath(filter, ""));
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2">
      <label className="min-w-[16rem] flex-1 space-y-1">
        <span className="text-sm font-medium text-slate-700">Search</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, domain, or alias…"
          className={formInputClass}
        />
      </label>
      <button
        type="submit"
        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Search
      </button>
      {initialSearch.trim() !== "" ? (
        <button
          type="button"
          onClick={handleClear}
          className="h-10 rounded-lg px-3 text-sm text-slate-600 hover:text-slate-900"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
