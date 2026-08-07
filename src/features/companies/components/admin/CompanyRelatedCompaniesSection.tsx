"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { AddRelatedCompanyModal } from "@/src/features/companies/components/admin/AddRelatedCompanyModal";
import type { RelatedCompanyAdminRow } from "@/src/features/companies/server/companyRelatedAdmin";

type CompanyRelatedCompaniesSectionProps = {
  companyId: string;
  related: RelatedCompanyAdminRow[];
  canEdit: boolean;
};

type RemoveRelatedApiResponse = {
  ok: boolean;
  error?: string;
};

export function CompanyRelatedCompaniesSection({
  companyId,
  related,
  canEdit,
}: CompanyRelatedCompaniesSectionProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const excludeIds = [companyId, ...related.map((row) => row.company_id)];

  async function handleRemove(row: RelatedCompanyAdminRow) {
    if (!canEdit || removingId !== null) return;
    if (!window.confirm(`Remove related link to ${row.name}?`)) {
      return;
    }

    setRemovingId(row.relation_id);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/companies/${companyId}/related/${row.relation_id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as RemoveRelatedApiResponse;
      if (!data.ok) {
        setError(data.error ?? "Could not remove related company.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not remove related company.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Related Companies ({related.length})
      </h2>

      {error ? (
        <div className="mb-3">
          <InlineErrorBanner message={error} />
        </div>
      ) : null}

      {related.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">No related companies yet.</p>
      ) : (
        <ul className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-1 text-sm text-slate-900">
          {related.map((row) => (
            <li
              key={row.relation_id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3 last:border-0"
            >
              <Link
                href={`/admin/companies/${row.company_id}`}
                className="font-medium text-brand-primary hover:underline"
              >
                {row.name}
              </Link>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={removingId !== null}
                  onClick={() => void handleRemove(row)}
                >
                  {removingId === row.relation_id ? "Removing…" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
          + Add Related Company
        </Button>
      ) : null}

      {canEdit ? (
        <AddRelatedCompanyModal
          open={modalOpen}
          companyId={companyId}
          excludeIds={excludeIds}
          onClose={() => setModalOpen(false)}
          onCreated={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
