"use client";

import { readConflictString } from "@/src/features/companies/components/admin/merge/mergeConflictRowUtils";
import type { CompanyMergeResolutions } from "@/src/features/companies/server/companyMerge";
import type { DraftLinkConflictStrategy } from "@/src/features/companies/server/companyMerge";
import { formInputClass } from "@/src/lib/design/classes";

type MergeDraftLinkConflictsTableProps = {
  conflicts: readonly Record<string, unknown>[];
  resolutions: CompanyMergeResolutions;
  canonicalName: string;
  duplicateName: string;
  onStrategyChange: (batchId: string, strategy: DraftLinkConflictStrategy) => void;
};

export function MergeDraftLinkConflictsTable({
  conflicts,
  resolutions,
  canonicalName,
  duplicateName,
  onStrategyChange,
}: MergeDraftLinkConflictsTableProps) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No import draft batch conflicts.
      </p>
    );
  }

  const strategyByBatch = new Map<string, DraftLinkConflictStrategy>();
  for (const entry of resolutions.draft_link_conflicts) {
    strategyByBatch.set(entry.batch_id, entry.strategy);
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-medium text-slate-900">Import draft conflicts</h3>
        <p className="text-sm text-slate-500">
          Both companies have draft links in these import batches. Choose which draft link to
          keep.
        </p>
      </div>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Batch</th>
            <th className="px-4 py-2 font-medium">Note</th>
            <th className="px-4 py-2 font-medium">Strategy</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((row) => {
            const batchId = readConflictString(row, "batch_id");
            const note = readConflictString(row, "note");
            const strategy = strategyByBatch.get(batchId) ?? "keep_canonical_draft";

            return (
              <tr key={batchId} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{batchId}</td>
                <td className="px-4 py-3 text-slate-600">{note}</td>
                <td className="px-4 py-3">
                  <select
                    className={`${formInputClass} min-w-[14rem]`}
                    value={strategy}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "keep_canonical_draft" || next === "keep_duplicate_draft") {
                        onStrategyChange(batchId, next);
                      }
                    }}
                  >
                    <option value="keep_canonical_draft">Keep {canonicalName} draft</option>
                    <option value="keep_duplicate_draft">Keep {duplicateName} draft</option>
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
