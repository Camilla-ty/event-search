"use client";

import { useEffect, useState } from "react";

import { formInputClass } from "@/src/lib/design/classes";

const SEARCH_MIN_CHARS = 2;

export type MergedIntoSeriesOption = {
  id: string;
  name: string;
  slug: string;
};

type MergedIntoSeriesPickerProps = {
  selected: MergedIntoSeriesOption | null;
  onSelect: (series: MergedIntoSeriesOption) => void;
  onClear: () => void;
  excludeSeriesId?: string;
  disabled?: boolean;
};

type SeriesSearchRow = {
  id: string;
  name: string;
  slug: string;
};

function mapSearchRow(row: SeriesSearchRow): MergedIntoSeriesOption {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
  };
}

export function MergedIntoSeriesPicker({
  selected,
  onSelect,
  onClear,
  excludeSeriesId,
  disabled = false,
}: MergedIntoSeriesPickerProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MergedIntoSeriesOption[]>([]);
  const [loading, setLoading] = useState(false);

  const term = search.trim();

  useEffect(() => {
    if (term.length < SEARCH_MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ search: term });
    void fetch(`/api/admin/event-series?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          ok: boolean;
          series?: SeriesSearchRow[];
        };
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.series)) {
          setResults([]);
          return;
        }
        const mapped = data.series
          .map(mapSearchRow)
          .filter((series) => series.id !== excludeSeriesId);
        setResults(mapped.slice(0, 12));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [term, excludeSeriesId]);

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">
          Merged into series <span className="text-red-600">*</span>
        </span>
        <span className="block text-sm text-slate-500">
          Search for the destination event series users should navigate to.
        </span>
        <input
          type="search"
          className={formInputClass}
          placeholder={`Search series (min ${SEARCH_MIN_CHARS} characters)…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
        />
      </label>

      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-brand-primary/30 bg-brand-primary-muted px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{selected.name}</p>
            <p className="truncate text-xs text-slate-500">/events/series/{selected.slug}</p>
          </div>
          <button
            type="button"
            className="ml-3 shrink-0 text-sm text-slate-600 hover:text-slate-900"
            onClick={onClear}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : null}

      {!selected && term.length >= SEARCH_MIN_CHARS ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No series found.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
              {results.map((series) => (
                <li key={series.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      onSelect(series);
                      setSearch("");
                      setResults([]);
                    }}
                    disabled={disabled}
                  >
                    <p className="text-sm font-medium text-slate-900">{series.name}</p>
                    <p className="text-xs text-slate-500">/events/series/{series.slug}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
