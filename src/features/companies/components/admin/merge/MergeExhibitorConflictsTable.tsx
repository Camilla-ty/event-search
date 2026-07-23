"use client";

import {
  formatTier,
  readConflictLink,
  readConflictString,
} from "@/src/features/companies/components/admin/merge/mergeConflictRowUtils";
import type { CompanyMergeResolutions } from "@/src/features/companies/server/companyMerge";
import type { ExhibitorConflictStrategy } from "@/src/features/companies/server/companyMerge";
import { formInputClass } from "@/src/lib/design/classes";

type MergeExhibitorConflictsTableProps = {
  conflicts: readonly Record<string, unknown>[];
  resolutions: CompanyMergeResolutions;
  canonicalName: string;
  duplicateName: string;
  onStrategyChange: (eventEditionId: string, strategy: ExhibitorConflictStrategy) => void;
};

export function MergeExhibitorConflictsTable({
  conflicts,
  resolutions,
  canonicalName,
  duplicateName,
  onStrategyChange,
}: MergeExhibitorConflictsTableProps) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No event conflicts. Exhibitor links will be repointed without tier decisions.
      </p>
    );
  }

  const strategyByEdition = new Map<string, ExhibitorConflictStrategy>();
  for (const entry of resolutions.exhibitor_conflicts) {
    strategyByEdition.set(entry.event_edition_id, entry.strategy);
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-medium text-slate-900">Exhibitor event conflicts</h3>
        <p className="text-sm text-slate-500">
          Both companies exhibit at these events. Choose which tier to keep for each event.
        </p>
      </div>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Event</th>
            <th className="px-4 py-2 font-medium">Canonical tier</th>
            <th className="px-4 py-2 font-medium">Duplicate tier</th>
            <th className="px-4 py-2 font-medium">Strategy</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((row) => {
            const editionId = readConflictString(row, "event_edition_id");
            const editionName = readConflictString(row, "edition_name");
            const editionYear = row.edition_year;
            const yearLabel = typeof editionYear === "number" ? String(editionYear) : "";
            const strategy = strategyByEdition.get(editionId) ?? "keep_canonical";

            return (
              <tr key={editionId} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  {editionName}
                  {yearLabel !== "" ? ` (${yearLabel})` : ""}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {formatTier(readConflictLink(row, "canonical_link"))}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {formatTier(readConflictLink(row, "duplicate_link"))}
                </td>
                <td className="px-4 py-3">
                  <select
                    className={`${formInputClass} min-w-[14rem]`}
                    value={strategy}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "keep_canonical" || next === "keep_duplicate_tier") {
                        onStrategyChange(editionId, next);
                      }
                    }}
                  >
                    <option value="keep_canonical">Keep {canonicalName} tier</option>
                    <option value="keep_duplicate_tier">Keep {duplicateName} tier</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
