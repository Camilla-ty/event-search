"use client";

import { MergeCompanyCompareCard } from "@/src/features/companies/components/admin/merge/MergeCompanyCompareCard";
import { isCanonicalSelectionLocked } from "@/src/features/companies/components/admin/merge/mergeWizardCanonical";
import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { suggestCanonicalCompanyId } from "@/src/features/companies/components/admin/merge/useCompanyAdminSearch";

type MergeCanonicalSelectorProps = {
  companyA: MergeCompanyPickerOption;
  companyB: MergeCompanyPickerOption;
  canonicalId: string;
  lockCanonical: boolean;
  lockDuplicate: boolean;
  onCanonicalIdChange: (companyId: string) => void;
};

export function MergeCanonicalSelector({
  companyA,
  companyB,
  canonicalId,
  lockCanonical,
  lockDuplicate,
  onCanonicalIdChange,
}: MergeCanonicalSelectorProps) {
  const locks = { lockCanonical, lockDuplicate };
  const selectionLocked = isCanonicalSelectionLocked(locks);
  const suggestedId = suggestCanonicalCompanyId(companyA, companyB);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Choose canonical company</h2>
        <p className="mt-1 text-sm text-slate-600">
          The canonical company keeps its profile URL and receives merged sponsorships.
          The other company will be soft-archived and its name added as an alias.
        </p>
        {selectionLocked ? (
          <p className="mt-2 text-sm text-slate-500">
            Canonical company is fixed from the company profile entry point.
          </p>
        ) : suggestedId === canonicalId ? (
          <p className="mt-2 text-sm text-slate-500">
            Suggested keeper pre-selected based on sponsorship count, domain, and age.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[companyA, companyB].map((company) => {
          const isCanonical = company.id === canonicalId;

          return (
            <label
              key={company.id}
              className={[
                "block rounded-xl transition",
                selectionLocked ? "cursor-default" : "cursor-pointer",
                isCanonical ? "ring-2 ring-brand-primary/20" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name="merge-canonical"
                className="sr-only"
                checked={isCanonical}
                disabled={selectionLocked}
                onChange={() => onCanonicalIdChange(company.id)}
              />
              <MergeCompanyCompareCard
                company={company}
                badge={isCanonical ? "Keep (canonical)" : "Merge away"}
                highlight={isCanonical}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
