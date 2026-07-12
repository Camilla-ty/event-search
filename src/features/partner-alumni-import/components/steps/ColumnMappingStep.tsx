"use client";

import { useMemo, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";
import {
  buildSpreadsheetColumnOptions,
  type SpreadsheetColumnOption,
} from "@/src/features/sponsor-import/columnMappingUi";
import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";
import { useImportProgressLabel } from "@/src/features/sponsor-import/components/ImportFlowProgress";

import { saveColumnMapping } from "../../client/api";
import type { ColumnMapping } from "../../types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { usePartnerAlumniImportWizard } from "../PartnerAlumniImportWizardContext";

type ColumnMappingStepProps = {
  spreadsheetHeaders: string[];
};

function normalizeMappingValue(stored: string, options: SpreadsheetColumnOption[]): string {
  const trimmed = stored.trim();
  if (options.some((o) => o.value === trimmed)) return trimmed;

  if (/^[A-Za-z]+$/.test(trimmed) && trimmed.length <= 3) {
    let idx = 0;
    for (const ch of trimmed.toUpperCase()) {
      idx = idx * 26 + (ch.charCodeAt(0) - 64);
    }
    const option = options[idx - 1];
    if (option) return option.value;
  }

  return options[0]?.value ?? trimmed;
}

export function ColumnMappingStep({ spreadsheetHeaders }: ColumnMappingStepProps) {
  const { scope, batch, goToStep, updateBatch } = usePartnerAlumniImportWizard();
  const columnOptions = useMemo(
    () => buildSpreadsheetColumnOptions(spreadsheetHeaders),
    [spreadsheetHeaders],
  );

  const initial = batch.column_mapping;
  const [mapping, setMapping] = useState<ColumnMapping>(() => ({
    company_name: normalizeMappingValue(initial.company_name ?? "", columnOptions),
    website: normalizeMappingValue(initial.website ?? "", columnOptions),
    display_order: initial.display_order
      ? normalizeMappingValue(initial.display_order, columnOptions)
      : undefined,
    notes: initial.notes,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImportProgressLabel(loading, IMPORT_PROGRESS.applyingMapping);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await saveColumnMapping(scope, batch.id, mapping, false);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    updateBatch(result.batch);
    goToStep("validation");
  }

  function renderSelect(
    label: string,
    field: keyof Pick<ColumnMapping, "company_name" | "website" | "display_order" | "notes">,
    required = false,
  ) {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required ? " *" : ""}
        </label>
        <select
          className={formInputClass}
          value={mapping[field] ?? ""}
          onChange={(e) =>
            setMapping((prev) => ({
              ...prev,
              [field]: e.target.value === "" ? undefined : e.target.value,
            }))
          }
        >
          {!required ? <option value="">— Not mapped —</option> : null}
          {columnOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Column mapping</h2>
        <p className="mt-1 text-sm text-slate-600">
          Confirm which spreadsheet columns map to company name, website, and optional display
          order. Required before validation — do not skip on ambiguous files.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {renderSelect("Company name", "company_name", true)}
        {renderSelect("Website", "website", false)}
        {renderSelect("Display order", "display_order", false)}
        {renderSelect("Notes", "notes", false)}
      </div>

      {loading ? <ImportProgressMessage message={IMPORT_PROGRESS.applyingMapping} /> : null}
      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => goToStep("upload")}>
          Back
        </Button>
        <Button onClick={() => void handleConfirm()} disabled={loading}>
          Continue to validation →
        </Button>
      </div>
    </div>
  );
}
