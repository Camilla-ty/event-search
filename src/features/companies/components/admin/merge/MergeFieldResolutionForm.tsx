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
  buildOptions: (canonicalName: string, duplicateName: string) => Array<{ value: string; label: string }>;
};

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "slug",
    label: "Slug",
    buildOptions: (canonicalName, duplicateName) => [
      { value: "canonical", label: `Keep ${canonicalName} slug (canonical)` },
      { value: "duplicate", label: `Use ${duplicateName} slug (duplicate)` },
    ],
  },
  {
    key: "domain",
    label: "Primary Identity (domain)",
    buildOptions: (canonicalName, duplicateName) => [
      { value: "canonical", label: `Keep ${canonicalName} Primary Identity` },
      { value: "duplicate", label: `Use ${duplicateName} Primary Identity` },
      { value: "non_empty", label: "Prefer non-empty Primary Identity" },
    ],
  },
  {
    key: "website",
    label: "Website (must match Primary Identity)",
    buildOptions: (canonicalName, duplicateName) => [
      { value: "canonical", label: `Keep ${canonicalName} website` },
      { value: "duplicate", label: `Use ${duplicateName} website` },
      { value: "non_empty", label: "Prefer non-empty website" },
    ],
  },
  {
    key: "logo",
    label: "Logo",
    buildOptions: (canonicalName, duplicateName) => [
      { value: "canonical", label: `Keep ${canonicalName} logo` },
      { value: "duplicate", label: `Use ${duplicateName} logo` },
      { value: "best_available", label: "Best available logo" },
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
        <p className="mt-1 text-sm text-slate-600">
          Values are applied to the canonical company{" "}
          <span className="font-medium text-slate-900">{canonical.name}</span>.{" "}
          <span className="font-medium text-slate-900">{duplicate.name}</span> will be
          merged away. Aliases from the duplicate are always merged in. Primary
          Identity selects the Match Key; website must resolve to that same
          identity.
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
            const options = config.buildOptions(canonical.name, duplicate.name);

            return (
              <div key={config.key} className="space-y-3 px-4 py-4">
                <p className="text-sm font-medium text-slate-900">{config.label}</p>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div className="rounded-lg border border-brand-primary/25 bg-brand-primary-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                      Canonical · will keep
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{canonical.name}</p>
                    <p className="mt-2 break-words text-sm text-slate-700">
                      {readFieldDiffDisplayValue(pair?.canonical)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Duplicate · will merge away
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{duplicate.name}</p>
                    <p className="mt-2 break-words text-sm text-slate-700">
                      {readFieldDiffDisplayValue(pair?.duplicate)}
                    </p>
                  </div>
                  <div className="md:min-w-[16rem]">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium uppercase text-slate-500">
                        Strategy for {canonical.name}
                      </span>
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
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
