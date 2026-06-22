"use client";

import {
  formatTier,
  readConflictLink,
  readConflictString,
} from "@/src/features/companies/components/admin/merge/mergeConflictRowUtils";
import type { CompanyMergeResolutions } from "@/src/features/companies/server/companyMerge";
import type { SponsorshipConflictStrategy } from "@/src/features/companies/server/companyMerge";
import { formInputClass } from "@/src/lib/design/classes";

type MergeSponsorshipConflictsTableProps = {
  conflicts: readonly Record<string, unknown>[];
  resolutions: CompanyMergeResolutions;
  canonicalName: string;
  duplicateName: string;
  onStrategyChange: (eventEditionId: string, strategy: SponsorshipConflictStrategy) => void;
};

export function MergeSponsorshipConflictsTable({
  conflicts,
  resolutions,
  canonicalName,
  duplicateName,
  onStrategyChange,
}: MergeSponsorshipConflictsTableProps) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No edition conflicts. Sponsorships will be repointed without tier decisions.
      </p>
    );
  }

  const strategyByEdition = new Map<string, SponsorshipConflictStrategy>();
  for (const entry of resolutions.sponsorship_conflicts) {
    strategyByEdition.set(entry.event_edition_id, entry.strategy);
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-medium text-slate-900">Edition conflicts</h3>
        <p className="text-sm text-slate-500">
          Both companies sponsor these editions. Choose which tier to keep for each edition.
        </p>
      </div>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Edition</th>
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
