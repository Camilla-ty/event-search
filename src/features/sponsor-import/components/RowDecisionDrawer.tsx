"use client";

import { useEffect, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

import { patchRowDecision } from "../client/api";
import type { SponsorImportRow } from "../client/types";

type CompanyOption = { id: string; name: string; domain: string | null };

type RowDecisionDrawerProps = {
  batchId: string;
  row: SponsorImportRow | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function RowDecisionDrawer({
  batchId,
  row,
  onClose,
  onUpdated,
}: RowDecisionDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  useEffect(() => {
    if (!row) return;
    setError(null);
    setSelectedCompanyId(row.resolved_company_id ?? row.proposed_company_id ?? "");
  }, [row]);

  useEffect(() => {
    if (!row || companySearch.trim().length < 2) {
      setCompanyOptions([]);
      return;
    }

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

  async function decide(
    decision_type: "use_matched" | "create_new" | "choose_different" | "exclude",
    extra?: { resolved_company_id?: string; duplicate_resolution?: "kept" | "excluded" },
  ) {
    if (!row) return;
    setLoading(true);
    setError(null);
    const result = await patchRowDecision(batchId, row.id, {
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

  const isDuplicate = row.duplicate_role === "duplicate";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Row {row.excel_row_number}
          </h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div>
            <p className="font-medium text-slate-900">{row.raw_company_name ?? "—"}</p>
            <p className="text-slate-600">{row.normalized_domain ?? row.raw_website ?? "—"}</p>
            <p className="text-slate-600">Tier: {row.mapped_tier_rank ?? "—"}</p>
          </div>

          {row.match_method ? (
            <p className="text-slate-600">
              Match: {row.match_method}
              {row.match_confidence ? ` (${row.match_confidence})` : ""}
            </p>
          ) : null}

          {row.conflict_type ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-950">
              Conflict: {row.conflict_type}
            </p>
          ) : null}

          {isDuplicate ? (
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="font-medium text-slate-800">Duplicate row in file</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() => void decide("exclude", { duplicate_resolution: "excluded" })}
                >
                  Exclude duplicate
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
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
                Use matched company
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
                {companyOptions.length > 0 ? (
                  <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                    {companyOptions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={[
                            "w-full px-3 py-2 text-left hover:bg-slate-50",
                            selectedCompanyId === c.id ? "bg-brand-primary-muted" : "",
                          ].join(" ")}
                          onClick={() => setSelectedCompanyId(c.id)}
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
