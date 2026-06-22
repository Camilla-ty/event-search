"use client";

import { MergeCompaniesWizard } from "@/src/features/companies/components/admin/merge/MergeCompaniesWizard";
import type { MergeWizardPrefill } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";

type MergeCompaniesPageClientProps = {
  prefill: MergeWizardPrefill;
};

export function MergeCompaniesPageClient({ prefill }: MergeCompaniesPageClientProps) {
  return <MergeCompaniesWizard prefill={prefill} />;
}
