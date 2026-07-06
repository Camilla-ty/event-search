"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";
import { ImportRowMatchReason } from "@/src/features/sponsor-import/components/ImportRowMatchReason";
import { hasImportRowMatchReason } from "@/src/features/sponsor-import/importRowMatchReason";

import { patchRowDecision } from "../client/api";
import type { ImportScope, PartnerAlumniImportRow } from "../client/types";
import {
  asSponsorImportRow,
  formatMatchConfidenceLabel,
  formatMatchMethodLabel,
  spreadsheetCompanyLabel,
  spreadsheetWebsiteLabel,
} from "../reviewRowDisplay";
import { resolveRowDomain } from "../reviewQueueEligibility";

type CompanyOption = { id: string; name: string; domain: string | null };

type RowDecisionDrawerProps = {
  scope: ImportScope;
  batchId: string;
  row: PartnerAlumniImportRow | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function RowDecisionDrawer({
  scope,
  batchId,
  row,
  onClose,
  onUpdated,
}: RowDecisionDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<{
    rowId: string;
    companyId: string;
  } | null>(null);

  useEffect(() => {
    if (!row || companySearch.trim().length < 2) return;

    let cancelled = false;
    async function search() {
      const res = await fetch(
        `/api/admin/companies?search=${encodeURIComponent(companySearch.trim())}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        companies?: Array<{ id: string; name: string; domain: string | null }>;
      };
      if (cancelled || !data.ok || !data.companies) return;
      setCompanyOptions(
        data.companies.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          domain: c.domain,
        })),
      );
    }
    void search();
    return () => {
      cancelled = true;
    };
  }, [companySearch, row]);

  if (!row) return null;

  const sponsorRow = asSponsorImportRow(row);
  const company = spreadsheetCompanyLabel(row);
  const sheetWebsite = spreadsheetWebsiteLabel(row);
  const domain = resolveRowDomain(row);
  const companyId = row.proposed_company_id ?? row.resolved_company_id;
  const selectedCompanyId =
    selectedCompany?.rowId === row.id
      ? selectedCompany.companyId
      : (row.resolved_company_id ?? row.proposed_company_id ?? "");
  const visibleCompanyOptions = companySearch.trim().length < 2 ? [] : companyOptions;

  const isDuplicate = row.duplicate_role === "duplicate";
  const duplicateClusterSize =
    typeof row.duplicate_cluster_size === "number" && row.duplicate_cluster_size > 1
      ? row.duplicate_cluster_size
      : null;
  const duplicateSiblingCount = duplicateClusterSize ? duplicateClusterSize - 1 : 0;
  const confidenceLabel = formatMatchConfidenceLabel(row.match_confidence);

  async function decide(
    decision_type: "use_matched" | "create_new" | "choose_different" | "exclude",
    extra?: { resolved_company_id?: string; duplicate_resolution?: "kept" | "excluded" },
  ) {
    if (!row) return;
    setLoading(true);
    setError(null);
    const result = await patchRowDecision(scope, batchId, row.id, {
      decision_type,
      resolved_company_id: extra?.resolved_company_id ?? null,
      duplicate_resolution: extra?.duplicate_resolution,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Row {row.excel_row_number}</h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Spreadsheet
              </p>
              <p className="mt-2 font-medium text-slate-900">{company.primary}</p>
              {company.secondary ? (
                <p className="mt-1 text-xs text-slate-600">{company.secondary}</p>
              ) : null}
              <p className="mt-2 text-slate-700">{domain || "—"}</p>
              {sheetWebsite && sheetWebsite !== domain ? (
                <p className="mt-1 text-xs text-slate-500">Raw: {sheetWebsite}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Display order: {row.mapped_display_order ?? "—"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Proposed catalog match
              </p>
              {row.proposed_company ? (
                <>
                  <p className="mt-2 font-medium text-slate-900">{row.proposed_company.name}</p>
                  <p className="text-slate-600">{row.proposed_company.domain ?? "—"}</p>
                  {companyId ? (
                    <Link
                      href={`/admin/companies/${companyId}`}
                      className="mt-2 inline-block text-brand-primary hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View company detail ↗
                    </Link>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-slate-600">No proposed match</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {row.match_method ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                    {formatMatchMethodLabel(row.match_method)}
                  </span>
                ) : null}
                {confidenceLabel ? (
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 font-medium text-sky-900">
                    {confidenceLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {hasImportRowMatchReason(sponsorRow) || row.proposed_company_id ? (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-800">Match explanation</p>
              <ImportRowMatchReason
                row={sponsorRow}
                layout="detail"
                showMatchedCompany={Boolean(row.proposed_company_id)}
              />
            </div>
          ) : null}

          {isDuplicate ? (
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">
                Duplicate{duplicateClusterSize ? ` (${duplicateClusterSize} rows)` : ""}
              </p>
              <p className="font-medium text-slate-700">Choose which row to keep.</p>
              {duplicateSiblingCount > 0 ? (
                <p className="text-slate-600">
                  Keeping this row excludes the other {duplicateSiblingCount}{" "}
                  {duplicateSiblingCount === 1 ? "duplicate" : "duplicates"}.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    void decide(row.proposed_company_id ? "use_matched" : "create_new", {
                      duplicate_resolution: "kept",
                    })
                  }
                >
                  Keep this row
                </Button>
              </div>
            </div>
          ) : null}

          {!isDuplicate ? (
            <div className="space-y-2">
              <Button
                className="w-full justify-start"
                variant="secondary"
                disabled={loading || !row.proposed_company_id}
                onClick={() => void decide("use_matched")}
              >
                {row.proposed_company?.name
                  ? `Use matched company: ${row.proposed_company.name}`
                  : "Use matched company"}
              </Button>
              <Button
                className="w-full justify-start"
                variant="secondary"
                disabled={loading}
                onClick={() => void decide("create_new")}
              >
                Create new company
              </Button>
              <Button
                className="w-full justify-start"
                variant="secondary"
                disabled={loading}
                onClick={() => void decide("exclude")}
              >
                Exclude from import
              </Button>

              <div className="border-t border-slate-200 pt-3">
                <p className="mb-2 font-medium text-slate-700">Choose different company</p>
                <input
                  className={formInputClass}
                  placeholder="Search companies…"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
                {visibleCompanyOptions.length > 0 ? (
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                    {visibleCompanyOptions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={[
                            "w-full px-3 py-2 text-left hover:bg-slate-50",
                            selectedCompanyId === c.id ? "bg-brand-primary-muted" : "",
                          ].join(" ")}
                          onClick={() =>
                            setSelectedCompany({ rowId: row.id, companyId: c.id })
                          }
                        >
                          {c.name}
                          {c.domain ? (
                            <span className="ml-2 text-xs text-slate-500">{c.domain}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  className="mt-2 w-full"
                  disabled={loading || !selectedCompanyId}
                  onClick={() =>
                    void decide("choose_different", { resolved_company_id: selectedCompanyId })
                  }
                >
                  Use selected company
                </Button>
              </div>
            </div>
          ) : null}

          {error ? <InlineErrorBanner message={error} /> : null}
        </div>
      </div>
    </div>
  );
}
