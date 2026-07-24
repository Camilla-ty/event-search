"use client";

import {
  readConflictLink,
  readConflictString,
} from "@/src/features/companies/components/admin/merge/mergeConflictRowUtils";
import type { CompanyMergeResolutions } from "@/src/features/companies/server/companyMerge";
import type { OrganizerConflictStrategy } from "@/src/features/companies/server/companyMerge";
import { formInputClass } from "@/src/lib/design/classes";

function formatOrganizerRole(link: Record<string, unknown> | null): string {
  if (!link) return "—";
  const role = readConflictString(link, "role_label");
  const order = link.display_order;
  const orderLabel = typeof order === "number" ? String(order) : "—";
  return `${role || "—"} (order ${orderLabel})`;
}

type MergeOrganizerConflictsTableProps = {
  conflicts: readonly Record<string, unknown>[];
  resolutions: CompanyMergeResolutions;
  canonicalName: string;
  duplicateName: string;
  onStrategyChange: (eventEditionId: string, strategy: OrganizerConflictStrategy) => void;
};

export function MergeOrganizerConflictsTable({
  conflicts,
  resolutions,
  canonicalName,
  duplicateName,
  onStrategyChange,
}: MergeOrganizerConflictsTableProps) {
  if (conflicts.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No organizer conflicts. Organizer links will be repointed without role decisions.
      </p>
    );
  }

  const strategyByEdition = new Map<string, OrganizerConflictStrategy>();
  for (const entry of resolutions.organizer_conflicts) {
    strategyByEdition.set(entry.event_edition_id, entry.strategy);
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-medium text-slate-900">Organizer conflicts</h3>
        <p className="text-sm text-slate-500">
          Both companies organize these events. Choose which organizer role to keep.
        </p>
      </div>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Event</th>
            <th className="px-4 py-2 font-medium">Canonical role</th>
            <th className="px-4 py-2 font-medium">Duplicate role</th>
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
                <td className="px-4 py-3 text-slate-700">
                  {formatOrganizerRole(readConflictLink(row, "canonical_link"))}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatOrganizerRole(readConflictLink(row, "duplicate_link"))}
                </td>
                <td className="px-4 py-3">
                  <select
                    className={`${formInputClass} min-w-[14rem]`}
                    value={strategy}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "keep_canonical" || next === "keep_duplicate_role") {
                        onStrategyChange(editionId, next);
                      }
                    }}
                  >
                    <option value="keep_canonical">Keep {canonicalName} role</option>
                    <option value="keep_duplicate_role">Keep {duplicateName} role</option>
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
