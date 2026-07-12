"use client";

import { FormEvent, useEffect, useState } from "react";

import { formInputClass } from "@/src/lib/design/classes";

type AdminVenuesSearchFormProps = {
  search: string;
  onSubmit: (search: string) => void;
  onClear: () => void;
};

export function AdminVenuesSearchForm({
  search,
  onSubmit,
  onClear,
}: AdminVenuesSearchFormProps) {
  const [draftSearch, setDraftSearch] = useState(search);

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(draftSearch);
  }

  function handleClear() {
    setDraftSearch("");
    onClear();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2">
      <label className="min-w-[16rem] flex-1 space-y-1">
        <span className="text-sm font-medium text-slate-700">Search</span>
        <input
          type="search"
          value={draftSearch}
          onChange={(event) => setDraftSearch(event.target.value)}
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
      {search.trim() !== "" ? (
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
