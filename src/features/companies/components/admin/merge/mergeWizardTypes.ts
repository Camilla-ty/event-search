import type { CompanyMergePreviewSnapshot } from "@/src/features/companies/server/companyMerge";

export type MergeWizardStep = 1 | 2 | 3 | 4 | 5;

export type MergeCompanyPickerOption = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  sponsor_link_count: number;
  matched_alias: string | null;
  created_at: string | null;
};

export type MergeWizardPrefill = {
  canonical: MergeCompanyPickerOption | null;
  duplicate: MergeCompanyPickerOption | null;
  lockCanonical: boolean;
  lockDuplicate: boolean;
};

export type MergePreviewState = {
  loading: boolean;
  error: string | null;
  data: CompanyMergePreviewSnapshot | null;
};

export type MergePreviewApiResponse =
  | { ok: true; preview: CompanyMergePreviewSnapshot }
  | { ok: false; error: string };

export const MERGE_SEARCH_MIN_CHARS = 2;

export const MERGE_WIZARD_STEPS: Array<{ step: MergeWizardStep; label: string }> = [
  { step: 1, label: "Select companies" },
  { step: 2, label: "Choose canonical" },
  { step: 3, label: "Preview impact" },
  { step: 4, label: "Resolve conflicts" },
  { step: 5, label: "Confirm merge" },
];
