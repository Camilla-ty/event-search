import type { ReactNode } from "react";

import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";

import type { SponsorImportRow } from "../client/types";
import { resolveImportRowMatchReason } from "../importRowMatchReason";

type ImportRowMatchReasonProps = {
  row: SponsorImportRow;
  layout?: "compact" | "detail";
  showMatchedCompany?: boolean;
  className?: string;
};

function warningClassName(layout: "compact" | "detail"): string {
  if (layout === "detail") {
    return "rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950";
  }
  return "text-xs text-amber-800";
}

function infoClassName(layout: "compact" | "detail"): string {
  if (layout === "detail") {
    return "text-sm text-slate-700";
  }
  return "text-xs text-slate-600";
}

export function ImportRowMatchReason({
  row,
  layout = "compact",
  showMatchedCompany = false,
  className = "",
}: ImportRowMatchReasonProps): ReactNode {
  const reason = resolveImportRowMatchReason(row);
  const proposedCompany = row.proposed_company;
  const showCompany =
    showMatchedCompany && proposedCompany !== null && proposedCompany !== undefined;

  if (!reason && !showCompany) {
    return null;
  }

  const infoClass = infoClassName(layout);
  const warningClass = warningClassName(layout);

  return (
    <div className={["space-y-1", className].filter(Boolean).join(" ")}>
      {showCompany ? (
        <p className={layout === "detail" ? "text-sm font-medium text-slate-900" : "text-xs font-medium text-slate-800"}>
          {proposedCompany?.name}
          {proposedCompany?.domain ? (
            <span className="ml-2 font-normal text-slate-500">{proposedCompany.domain}</span>
          ) : null}
        </p>
      ) : null}

      {reason?.kind === "domain" ? (
        <p className={infoClass}>
          Matched by domain
          {reason.domain ? `: ${reason.domain}` : ""}
        </p>
      ) : null}

      {reason?.kind === "website" ? (
        <p className={infoClass}>
          Matched by website URL
          {reason.website ? `: ${reason.website}` : ""}
        </p>
      ) : null}

      {reason?.kind === "exact_name" ? (
        <p className={infoClass}>Matched by exact name</p>
      ) : null}

      {reason?.kind === "alias" ? (
        <AdminCompanySearchMatchHint
          matchedAlias={reason.alias ?? null}
          className={infoClass}
        />
      ) : null}

      {reason?.kind === "domain_name_mismatch" ? (
        <p className={warningClass}>
          {row.match_method === "website" || (row.normalized_domain ?? "").trim() === ""
            ? "Website URL matched, but company name differs. Please verify manually."
            : "Domain matched, but company name differs. Please verify manually."}
        </p>
      ) : null}

      {reason?.kind === "multiple_candidates" ? (
        <p className={warningClass}>
          Multiple companies match. Please verify manually.
        </p>
      ) : null}
    </div>
  );
}
