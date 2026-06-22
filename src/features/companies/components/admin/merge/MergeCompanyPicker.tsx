"use client";

import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { MERGE_SEARCH_MIN_CHARS } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { useCompanyAdminSearch } from "@/src/features/companies/components/admin/merge/useCompanyAdminSearch";
import { formInputClass } from "@/src/lib/design/classes";

type MergeCompanyPickerProps = {
  label: string;
  description?: string;
  selected: MergeCompanyPickerOption | null;
  onSelect: (company: MergeCompanyPickerOption) => void;
  onClear: () => void;
  disabled?: boolean;
  excludeIds?: readonly string[];
};

export function MergeCompanyPicker({
  label,
  description,
  selected,
  onSelect,
  onClear,
  disabled = false,
  excludeIds = [],
}: MergeCompanyPickerProps) {
  const { search, setSearch, results, loading, showNoResults, term } =
    useCompanyAdminSearch({ excludeIds });

  if (disabled && selected) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="font-medium text-slate-900">{selected.name}</p>
          {selected.domain ? (
            <p className="text-sm text-slate-500">{selected.domain}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            {selected.sponsor_link_count} sponsorship
            {selected.sponsor_link_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {description ? <span className="block text-sm text-slate-500">{description}</span> : null}
        <input
          type="search"
          className={formInputClass}
          placeholder={`Search companies (min ${MERGE_SEARCH_MIN_CHARS} characters)…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
        />
      </label>

      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-brand-primary/30 bg-brand-primary-muted px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{selected.name}</p>
            {selected.domain ? (
              <p className="truncate text-sm text-slate-600">{selected.domain}</p>
            ) : null}
            <AdminCompanySearchMatchHint matchedAlias={selected.matched_alias} className="mt-0.5 block" />
          </div>
          <button
            type="button"
            className="ml-3 shrink-0 text-sm text-slate-600 hover:text-slate-900"
            onClick={onClear}
          >
            Change
          </button>
        </div>
      ) : null}

      {!selected && term.length >= MERGE_SEARCH_MIN_CHARS ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          {loading ? <p className="px-3 py-2 text-sm text-slate-500">Searching…</p> : null}
          {!loading && results.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto">
              {results.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      onSelect(company);
                      setSearch("");
                    }}
                  >
                    <span className="font-medium text-slate-900">{company.name}</span>
                    {company.domain ? (
                      <span className="ml-2 text-xs text-slate-500">{company.domain}</span>
                    ) : null}
                    {company.matched_alias ? (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Alias: {company.matched_alias}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {showNoResults ? (
            <p className="px-3 py-2 text-sm text-slate-500">No companies found.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
