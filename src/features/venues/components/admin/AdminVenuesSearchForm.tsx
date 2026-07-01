"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { formInputClass } from "@/src/lib/design/classes";

type AdminVenuesSearchFormProps = {
  initialSearch: string;
  includeArchived: boolean;
};

function buildVenuesListPath(search: string, includeArchived: boolean): string {
  const params = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed !== "") params.set("search", trimmed);
  if (includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  return query ? `/admin/venues?${query}` : "/admin/venues";
}

export function AdminVenuesSearchForm({
  initialSearch,
  includeArchived,
}: AdminVenuesSearchFormProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildVenuesListPath(search, includeArchived));
  }

  function handleClear() {
    setSearch("");
    router.push(buildVenuesListPath("", includeArchived));
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2">
      <label className="min-w-[16rem] flex-1 space-y-1">
        <span className="text-sm font-medium text-slate-700">Search</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, slug, or city…"
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
