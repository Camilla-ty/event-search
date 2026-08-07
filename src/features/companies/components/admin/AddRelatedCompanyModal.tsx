"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { InlineErrorBanner } from "@/src/components/common";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import { MERGE_SEARCH_MIN_CHARS } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { useCompanyAdminSearch } from "@/src/features/companies/components/admin/merge/useCompanyAdminSearch";
import { formInputClass } from "@/src/lib/design/classes";

type AddRelatedCompanyModalProps = {
  open: boolean;
  companyId: string;
  excludeIds: readonly string[];
  onClose: () => void;
  onCreated: () => void;
};

type AddRelatedApiResponse = {
  ok: boolean;
  error?: string;
  result?: { status: "created" | "already_related" };
};

export function AddRelatedCompanyModal({
  open,
  companyId,
  excludeIds,
  onClose,
  onCreated,
}: AddRelatedCompanyModalProps) {
  const [mounted, setMounted] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { search, setSearch, results, loading, showNoResults, term } = useCompanyAdminSearch({
    excludeIds,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setError(null);
    setSubmittingId(null);
  }, [open, setSearch]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && submittingId === null) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submittingId]);

  if (!mounted || !open) return null;

  async function handleSelect(relatedCompanyId: string) {
    if (submittingId !== null) return;

    setSubmittingId(relatedCompanyId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/companies/${companyId}/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ related_company_id: relatedCompanyId }),
      });
      const data = (await response.json()) as AddRelatedApiResponse;

      if (!data.ok) {
        setError(data.error ?? "Could not add related company.");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("Could not add related company.");
    } finally {
      setSubmittingId(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-related-company-title"
    >
      <div className="flex max-h-[min(32rem,90vh)] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2
            id="add-related-company-title"
            className="text-lg font-semibold text-slate-900"
          >
            Add related company
          </h2>
          <button
            type="button"
            className="text-sm text-slate-500 hover:text-slate-900"
            onClick={onClose}
            disabled={submittingId !== null}
          >
            Close
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <label className="block space-y-1">
            <span className="sr-only">Search companies</span>
            <input
              type="search"
              autoFocus
              className={formInputClass}
              placeholder={`Search companies (min ${MERGE_SEARCH_MIN_CHARS} characters)…`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={submittingId !== null}
            />
          </label>

          {error ? <InlineErrorBanner message={error} /> : null}

          {term.length < MERGE_SEARCH_MIN_CHARS ? (
            <p className="text-sm text-slate-500">
              Type at least {MERGE_SEARCH_MIN_CHARS} characters to search.
            </p>
          ) : null}

          {loading ? <p className="text-sm text-slate-500">Searching…</p> : null}

          {showNoResults ? (
            <p className="text-sm text-slate-500">No companies found.</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {results.map((company) => {
                const busy = submittingId === company.id;
                return (
                  <li key={company.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
                      disabled={submittingId !== null}
                      onClick={() => void handleSelect(company.id)}
                    >
                      <span className="font-medium text-slate-900">
                        {busy ? "Adding…" : company.name}
                      </span>
                      {company.domain ? (
                        <span className="text-sm text-slate-500">{company.domain}</span>
                      ) : null}
                      <AdminCompanySearchMatchHint
                        matchedAlias={company.matched_alias}
                        className="text-xs"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
