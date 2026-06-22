"use client";

import {
  fieldValuesDiffer,
  readFieldDiffDisplayValue,
  readFieldDiffPair,
} from "@/src/features/companies/components/admin/merge/mergeConflictRowUtils";
import type {
  CompanyMergeFieldResolutions,
  CompanyMergePreviewSnapshot,
} from "@/src/features/companies/server/companyMerge";
import { formInputClass } from "@/src/lib/design/classes";

type MergeFieldResolutionFormProps = {
  preview: CompanyMergePreviewSnapshot;
  fieldResolutions: CompanyMergeFieldResolutions;
  onFieldChange: <K extends keyof CompanyMergeFieldResolutions>(
    field: K,
    value: CompanyMergeFieldResolutions[K],
  ) => void;
};

type FieldConfig = {
  key: keyof CompanyMergeFieldResolutions;
  label: string;
  options: Array<{ value: string; label: string }>;
};

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "slug",
    label: "Slug",
    options: [
      { value: "canonical", label: "Keep canonical slug" },
      { value: "duplicate", label: "Use duplicate slug" },
    ],
  },
  {
    key: "domain",
    label: "Domain",
    options: [
      { value: "canonical", label: "Keep canonical domain" },
      { value: "duplicate", label: "Use duplicate domain" },
      { value: "non_empty", label: "Prefer non-empty value" },
    ],
  },
  {
    key: "website",
    label: "Website",
    options: [
      { value: "canonical", label: "Keep canonical website" },
      { value: "duplicate", label: "Use duplicate website" },
      { value: "non_empty", label: "Prefer non-empty value" },
    ],
  },
  {
    key: "logo",
    label: "Logo",
    options: [
      { value: "canonical", label: "Keep canonical logo" },
      { value: "duplicate", label: "Use duplicate logo" },
      { value: "best_available", label: "Best available logo" },
    ],
  },
  {
    key: "short_description",
    label: "Short description",
    options: [
      { value: "canonical", label: "Keep canonical text" },
      { value: "duplicate", label: "Use duplicate text" },
      { value: "longer", label: "Prefer longer text" },
      { value: "non_empty", label: "Prefer non-empty text" },
    ],
  },
  {
    key: "description",
    label: "Description",
    options: [
      { value: "canonical", label: "Keep canonical text" },
      { value: "duplicate", label: "Use duplicate text" },
      { value: "longer", label: "Prefer longer text" },
      { value: "non_empty", label: "Prefer non-empty text" },
    ],
  },
];

export function MergeFieldResolutionForm({
  preview,
  fieldResolutions,
  onFieldChange,
}: MergeFieldResolutionFormProps) {
  const { canonical, duplicate } = preview.companies;
  const fieldDiffs = preview.field_differences;

  const visibleFields = FIELD_CONFIGS.filter((config) => {
    const diffKey = config.key === "logo" ? "logo_url" : config.key;
    const pair = readFieldDiffPair(fieldDiffs, diffKey);
    if (!pair) return true;
    return fieldValuesDiffer(pair.canonical, pair.duplicate);
  });

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-medium text-slate-900">Profile field choices</h3>
        <p className="text-sm text-slate-500">
          Choose how to combine profile fields on the canonical company. Aliases from the
          duplicate are always merged in.
        </p>
      </div>

      {visibleFields.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-600">
          No differing profile fields. Defaults will keep canonical values.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleFields.map((config) => {
            const diffKey = config.key === "logo" ? "logo_url" : config.key;
            const pair = readFieldDiffPair(fieldDiffs, diffKey);
            const currentValue = fieldResolutions[config.key];

            return (
              <div key={config.key} className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_1fr_auto]">
                <div>
                  <p className="text-xs uppercase text-slate-500">{config.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{canonical.name}</p>
                  <p className="mt-1 break-words text-sm text-slate-700">
                    {readFieldDiffDisplayValue(pair?.canonical)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">{config.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{duplicate.name}</p>
                  <p className="mt-1 break-words text-sm text-slate-700">
                    {readFieldDiffDisplayValue(pair?.duplicate)}
                  </p>
                </div>
                <div className="md:min-w-[14rem]">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase text-slate-500">Strategy</span>
                    <select
                      className={formInputClass}
                      value={currentValue}
                      onChange={(event) => {
                        const next = event.target.value;
                        onFieldChange(
                          config.key,
                          next as CompanyMergeFieldResolutions[typeof config.key],
                        );
                      }}
                    >
                      {config.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
