"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

import {
  buildSpreadsheetColumnOptions,
  type SpreadsheetColumnOption,
} from "../../columnMappingUi";
import { saveColumnMapping } from "../../client/api";
import { flowHref } from "../../client/resumeStep";
import type { SponsorImportBatch } from "../../client/types";
import type { ColumnMapping } from "../../types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { useImportProgressLabel } from "../ImportFlowProgress";
import { ImportProgressMessage } from "../ImportProgressMessage";

type ColumnMappingStepProps = {
  batch: SponsorImportBatch;
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

export function ColumnMappingStep({ batch, spreadsheetHeaders }: ColumnMappingStepProps) {
  const router = useRouter();
  const columnOptions = useMemo(
    () => buildSpreadsheetColumnOptions(spreadsheetHeaders),
    [spreadsheetHeaders],
  );

  const initial = batch.column_mapping;
  const [mapping, setMapping] = useState<ColumnMapping>(() => ({
    company_name: normalizeMappingValue(initial.company_name ?? "", columnOptions),
    website: normalizeMappingValue(initial.website ?? "", columnOptions),
    tier_rank: normalizeMappingValue(initial.tier_rank ?? "", columnOptions),
    tier_label: normalizeMappingValue(initial.tier_label ?? "", columnOptions),
    notes: initial.notes,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImportProgressLabel(loading, IMPORT_PROGRESS.applyingMapping);

  const hasDetectedHeaders = spreadsheetHeaders.some((h) => h.trim() !== "");

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await saveColumnMapping(batch.id, mapping, false);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(flowHref(batch.id, "validation"));
  }

  function renderSelect(
    label: string,
    field: keyof Pick<ColumnMapping, "company_name" | "website" | "tier_rank" | "tier_label">,
  ) {
    return (
      <label className="text-sm font-medium text-slate-700">
        {label}
        <select
          className={formInputClass}
          value={mapping[field]}
          onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
        >
          {columnOptions.map((opt) => (
            <option key={`${field}-${opt.index}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Column mapping</h2>
        <p className="mt-1 text-sm text-slate-600">
          Map spreadsheet columns to sponsor tier, sponsor label, company name, and website.
        </p>
      </div>

      {hasDetectedHeaders ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Detected headers from row 1:{" "}
          <span className="font-medium">
            {spreadsheetHeaders
              .map((h) => h.trim())
              .filter((h) => h !== "")
              .join(" · ") || "—"}
          </span>
        </p>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No header row detected. Columns are shown as Column A, Column B, etc.
        </p>
      )}

      <div className="grid max-w-lg gap-4">
        {renderSelect("Sponsor tier column", "tier_rank")}
        {renderSelect("Sponsor label column", "tier_label")}
        {renderSelect("Company name column", "company_name")}
        {renderSelect("Website column", "website")}
      </div>

      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/admin/sponsor-imports")}>
          Save & exit
        </Button>
        <Button onClick={() => void handleConfirm()} disabled={loading}>
          {loading ? "Applying column mapping…" : "Confirm mapping →"}
        </Button>
      </div>
    </div>
  );
}
