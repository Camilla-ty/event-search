"use client";

import type { KeywordRow } from "@/src/features/events/types/keywords";

type SeriesKeywordMultiSelectProps = {
  keywords: KeywordRow[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function SeriesKeywordMultiSelect({
  keywords,
  selectedIds,
  onChange,
  disabled = false,
}: SeriesKeywordMultiSelectProps) {
  const selectedSet = new Set(selectedIds);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  if (keywords.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No keywords in the directory yet. Add rows to the <code className="text-xs">keyword</code>{" "}
        table, then refresh this page.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        {selectedIds.length} selected · applies to all events in this event brand
      </p>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => {
            const checked = selectedSet.has(keyword.id);
            return (
              <label
                key={keyword.id}
                className={[
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                  checked
                    ? "border-brand-primary bg-brand-primary-muted text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  disabled ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(keyword.id)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium">{keyword.name}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
