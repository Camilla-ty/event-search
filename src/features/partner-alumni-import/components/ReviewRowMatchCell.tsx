import Link from "next/link";

import { ImportRowMatchReason } from "@/src/features/sponsor-import/components/ImportRowMatchReason";
import { hasImportRowMatchReason } from "@/src/features/sponsor-import/importRowMatchReason";

import type { PartnerAlumniImportRow } from "../client/types";
import {
  asSponsorImportRow,
  formatMatchConfidenceLabel,
  formatMatchMethodLabel,
} from "../reviewRowDisplay";

type ReviewRowMatchCellProps = {
  row: PartnerAlumniImportRow;
};

export function ReviewRowMatchCell({ row }: ReviewRowMatchCellProps) {
  const sponsorRow = asSponsorImportRow(row);
  const companyId = row.proposed_company_id ?? row.resolved_company_id;
  const showMatchReason = hasImportRowMatchReason(sponsorRow) || Boolean(row.proposed_company_id);

  if (!showMatchReason && !row.match_method) {
    return <span className="text-slate-500">No match proposed</span>;
  }

  const confidenceLabel = formatMatchConfidenceLabel(row.match_confidence);

  return (
    <div className="min-w-[14rem] max-w-lg space-y-2">
      {showMatchReason ? (
        <ImportRowMatchReason
          row={sponsorRow}
          layout="compact"
          showMatchedCompany={Boolean(row.proposed_company_id)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {row.match_method ? (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
            {formatMatchMethodLabel(row.match_method)}
          </span>
        ) : null}
        {confidenceLabel ? (
          <span className="rounded-md bg-sky-50 px-2 py-0.5 font-medium text-sky-900">
            {confidenceLabel}
          </span>
        ) : null}
      </div>

      {companyId ? (
        <Link
          href={`/admin/companies/${companyId}`}
          className="inline-block text-xs font-medium text-brand-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View matched company ↗
        </Link>
      ) : null}
    </div>
  );
}
