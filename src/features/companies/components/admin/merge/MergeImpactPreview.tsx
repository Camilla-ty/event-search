"use client";

import {
  formatTier,
  readConflictLink,
  readConflictString,
} from "@/src/features/companies/components/admin/merge/mergeConflictRowUtils";
import type { CompanyMergePreviewSnapshot } from "@/src/features/companies/server/companyMerge";
import { InlineErrorBanner } from "@/src/components/common";

type MergeImpactPreviewProps = {
  loading: boolean;
  error: string | null;
  preview: CompanyMergePreviewSnapshot | null;
};

export function MergeImpactPreview({ loading, error, preview }: MergeImpactPreviewProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading merge preview…
      </div>
    );
  }

  if (error) {
    return <InlineErrorBanner message={error} />;
  }

  if (!preview) {
    return null;
  }

  const { impact, sponsorship_conflicts, draft_link_conflicts, warnings, required_resolutions } =
    preview;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Preview impact</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review what will change when these companies are merged.
        </p>
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactStat label="Sponsorships to repoint" value={impact.event_sponsors_to_repoint} />
        <ImpactStat
          label="Import rows (proposed)"
          value={impact.import_rows_proposed_to_repoint}
        />
        <ImpactStat
          label="Import rows (resolved)"
          value={impact.import_rows_resolved_to_repoint}
        />
        <ImpactStat label="Draft links to repoint" value={impact.draft_links_to_repoint} />
      </div>

      {sponsorship_conflicts.length > 0 ? (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-medium text-slate-900">Edition conflicts</h3>
            <p className="text-sm text-slate-500">
              Both companies sponsor these editions. Choose strategies on the next step if you
              continue.
            </p>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Edition</th>
                <th className="px-4 py-2 font-medium">Canonical tier</th>
                <th className="px-4 py-2 font-medium">Duplicate tier</th>
              </tr>
            </thead>
            <tbody>
              {sponsorship_conflicts.map((row) => {
                const editionName = readConflictString(row, "edition_name");
                const editionYear = row.edition_year;
                const yearLabel =
                  typeof editionYear === "number" ? String(editionYear) : "";
                const canonicalLink = readConflictLink(row, "canonical_link");
                const duplicateLink = readConflictLink(row, "duplicate_link");

                return (
                  <tr key={readConflictString(row, "event_edition_id")} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {editionName}
                      {yearLabel !== "" ? ` (${yearLabel})` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatTier(canonicalLink)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatTier(duplicateLink)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {draft_link_conflicts.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <h3 className="font-medium text-slate-900">Import draft conflicts</h3>
          <p className="mt-1 text-sm text-slate-500">
            {draft_link_conflicts.length} batch
            {draft_link_conflicts.length === 1 ? "" : "es"} where both companies have draft
            links.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {draft_link_conflicts.map((row) => (
              <li key={readConflictString(row, "batch_id")} className="font-mono text-xs">
                Batch {readConflictString(row, "batch_id")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {required_resolutions.sponsorship_conflicts.length === 0 &&
        required_resolutions.draft_link_conflicts.length === 0 ? (
          <p>No edition or import batch conflicts detected. Repointing only.</p>
        ) : (
          <p>
            {required_resolutions.sponsorship_conflicts.length} edition conflict
            {required_resolutions.sponsorship_conflicts.length === 1 ? "" : "s"} and{" "}
            {required_resolutions.draft_link_conflicts.length} draft batch conflict
            {required_resolutions.draft_link_conflicts.length === 1 ? "" : "s"} will need
            resolution before merge can run.
          </p>
        )}
      </div>
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
