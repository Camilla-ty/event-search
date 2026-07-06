"use client";

import { useMemo, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { AdminDrawerShell } from "@/src/features/admin/components/AdminDrawerShell";
import {
  buildPartnerAlumniBulkCommitPayloadRow,
  getDefaultPartnerAlumniBulkRowDecision,
  shouldPartnerAlumniBulkImportByDefault,
  type PartnerAlumniBulkRowDecision,
} from "@/src/features/partner-alumni/lib/partnerAlumniBulkDefaults";
import {
  buildSpreadsheetColumnOptions,
  columnMappingValue,
  PARTNER_ALUMNI_BULK_MAX_ROWS,
  parsePartnerAlumniBulkSpreadsheet,
  type PartnerAlumniBulkColumnMapping,
  type PartnerAlumniBulkInputRow,
} from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";
import type { PartnerAlumniAdminData } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import type { PartnerAlumniBulkPreviewRow as PreviewRow } from "@/src/features/partner-alumni/server/partnerAlumniBulkImport";
import { feedbackSuccessClass, formInputClass, secondaryCtaClass } from "@/src/lib/design/classes";

type PartnerAlumniBulkUploadDrawerProps = {
  seriesId: string;
  versionId: string;
  versionLabel: string;
  onClose: () => void;
  onImported: (payload: PartnerAlumniAdminData) => void;
};

type PreviewSummary = {
  importSelected: number;
  skipSelected: number;
  review: number;
  createNew: number;
  matched: number;
  invalid: number;
  onRoster: number;
  duplicateInFile: number;
};

function statusLabel(status: PreviewRow["status"]): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "review":
      return "Review";
    case "create_new":
      return "New company";
    case "on_roster":
      return "On version";
    case "duplicate_in_file":
      return "Duplicate";
    case "invalid":
      return "Invalid";
    default:
      return status;
  }
}

function statusClass(status: PreviewRow["status"]): string {
  switch (status) {
    case "matched":
      return "bg-emerald-100 text-emerald-800";
    case "review":
      return "bg-amber-100 text-amber-900";
    case "create_new":
      return "bg-sky-100 text-sky-900";
    case "on_roster":
      return "bg-slate-100 text-slate-600";
    case "duplicate_in_file":
      return "bg-slate-100 text-slate-600";
    case "invalid":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function buildPreviewSummary(
  previewRows: PreviewRow[],
  decisions: Record<number, PartnerAlumniBulkRowDecision>,
): PreviewSummary {
  const summary: PreviewSummary = {
    importSelected: 0,
    skipSelected: 0,
    review: 0,
    createNew: 0,
    matched: 0,
    invalid: 0,
    onRoster: 0,
    duplicateInFile: 0,
  };

  for (const row of previewRows) {
    switch (row.status) {
      case "review":
        summary.review += 1;
        break;
      case "create_new":
        summary.createNew += 1;
        break;
      case "matched":
        summary.matched += 1;
        break;
      case "invalid":
        summary.invalid += 1;
        break;
      case "on_roster":
        summary.onRoster += 1;
        break;
      case "duplicate_in_file":
        summary.duplicateInFile += 1;
        break;
      default:
        break;
    }

    const decision = decisions[row.row_number] ?? getDefaultPartnerAlumniBulkRowDecision(row);
    if (decision.action === "import") {
      summary.importSelected += 1;
    } else {
      summary.skipSelected += 1;
    }
  }

  return summary;
}

function shouldBlockLowImport(parsedRowCount: number, importSelected: number): boolean {
  return parsedRowCount >= 10 && importSelected <= 1;
}

function shouldWarnLowImport(parsedRowCount: number, importSelected: number): boolean {
  if (parsedRowCount < 10) return false;
  if (importSelected <= 1) return true;
  return importSelected / parsedRowCount < 0.1;
}

export function PartnerAlumniBulkUploadDrawer({
  seriesId,
  versionId,
  versionLabel,
  onClose,
  onImported,
}: PartnerAlumniBulkUploadDrawerProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [decisions, setDecisions] = useState<Record<number, PartnerAlumniBulkRowDecision>>({});
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [mappingHeaderRowIndex, setMappingHeaderRowIndex] = useState(0);
  const [mappingHeaderRow, setMappingHeaderRow] = useState<string[]>([]);
  const [mappingSampleRows, setMappingSampleRows] = useState<string[][]>([]);
  const [nameColumn, setNameColumn] = useState("");
  const [websiteColumn, setWebsiteColumn] = useState("");
  const [displayOrderColumn, setDisplayOrderColumn] = useState("");
  const [parsedRowCount, setParsedRowCount] = useState(0);

  const columnOptions = useMemo(
    () => buildSpreadsheetColumnOptions(mappingHeaderRow),
    [mappingHeaderRow],
  );

  const previewSummary = useMemo(
    () => buildPreviewSummary(previewRows, decisions),
    [previewRows, decisions],
  );

  const lowImportWarning = useMemo(
    () => shouldWarnLowImport(parsedRowCount, previewSummary.importSelected),
    [parsedRowCount, previewSummary.importSelected],
  );

  const blockLowImportCommit = useMemo(
    () => shouldBlockLowImport(parsedRowCount, previewSummary.importSelected),
    [parsedRowCount, previewSummary.importSelected],
  );

  const bulkBasePath = `/api/admin/event-series/${seriesId}/partner-alumni/versions/${versionId}/companies/bulk`;

  async function runPreview(parsedRows: PartnerAlumniBulkInputRow[]) {
    const res = await fetch(`${bulkBasePath}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parsedRows }),
    });
    const json = (await res.json()) as {
      ok: boolean;
      preview?: PreviewRow[];
      error?: string;
    };
    if (!res.ok || !json.ok || !Array.isArray(json.preview)) {
      throw new Error(json.error ?? "Failed to preview upload.");
    }

    const nextDecisions: Record<number, PartnerAlumniBulkRowDecision> = {};
    for (const row of json.preview) {
      nextDecisions[row.row_number] = getDefaultPartnerAlumniBulkRowDecision(row);
    }

    setPreviewRows(json.preview);
    setDecisions(nextDecisions);
    setParsedRowCount(parsedRows.length);
    setStep("preview");
  }

  function beginColumnMapping(
    buffer: ArrayBuffer,
    headerRowIndex: number,
    headerRow: string[],
    sampleRows: string[][],
  ) {
    setFileBuffer(buffer);
    setMappingHeaderRowIndex(headerRowIndex);
    setMappingHeaderRow(headerRow);
    setMappingSampleRows(sampleRows);

    const options = buildSpreadsheetColumnOptions(headerRow);
    const guessedName = options.find((option) =>
      /company|name|organization|partner/i.test(option.label),
    );
    const guessedWebsite = options.find((option) =>
      /website|domain|url/i.test(option.label),
    );
    const guessedOrder = options.find((option) => /order|rank|#/i.test(option.label));

    setNameColumn(guessedName?.value ?? columnMappingValue(headerRow, 0));
    setWebsiteColumn(guessedWebsite?.value ?? "");
    setDisplayOrderColumn(guessedOrder?.value ?? "");
    setStep("mapping");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parsePartnerAlumniBulkSpreadsheet(buffer);

      if (!parsed.ok) {
        if (parsed.code === "needs_column_mapping") {
          beginColumnMapping(
            buffer,
            parsed.headerRowIndex,
            parsed.headerRow,
            parsed.sampleRows,
          );
          setLoading(false);
          event.target.value = "";
          return;
        }

        setError(parsed.message);
        setLoading(false);
        return;
      }

      await runPreview(parsed.rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to read upload file.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function handleApplyColumnMapping() {
    if (!fileBuffer || nameColumn.trim() === "") {
      setError("Choose a column for company name.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const mapping: PartnerAlumniBulkColumnMapping = {
        name: nameColumn.trim(),
        website: websiteColumn.trim() !== "" ? websiteColumn.trim() : null,
        display_order: displayOrderColumn.trim() !== "" ? displayOrderColumn.trim() : null,
        header_row_index: mappingHeaderRowIndex,
      };
      const parsed = parsePartnerAlumniBulkSpreadsheet(fileBuffer, mapping);

      if (!parsed.ok) {
        if (parsed.code === "needs_column_mapping") {
          setError(parsed.message);
          setLoading(false);
          return;
        }
        setError(parsed.message);
        setLoading(false);
        return;
      }

      await runPreview(parsed.rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to parse mapped columns.");
    } finally {
      setLoading(false);
    }
  }

  function updateDecision(rowNumber: number, patch: Partial<PartnerAlumniBulkRowDecision>) {
    setDecisions((current) => ({
      ...current,
      [rowNumber]: {
        ...(current[rowNumber] ??
          getDefaultPartnerAlumniBulkRowDecision(
            previewRows.find((row) => row.row_number === rowNumber) ?? {
              row_number: rowNumber,
              name: "",
              website: null,
              display_order: null,
              status: "invalid",
              match_method: null,
              proposed_company_id: null,
              proposed_company_name: null,
              conflict_type: null,
              message: null,
            },
          )),
        ...patch,
      },
    }));
  }

  async function handleCommit() {
    setCommitting(true);
    setError(null);
    setSuccessMessage(null);

    const commitRows = previewRows.map((row) => {
      const decision = decisions[row.row_number] ?? getDefaultPartnerAlumniBulkRowDecision(row);
      return buildPartnerAlumniBulkCommitPayloadRow(row, decision);
    });

    try {
      const res = await fetch(`${bulkBasePath}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: commitRows }),
      });
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
        summary?: {
          imported: number;
          skipped: number;
          created_companies: number;
          already_on_roster: number;
        };
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to import rows.");
        setCommitting(false);
        return;
      }

      const summary = json.summary;
      const message = summary
        ? `Imported ${summary.imported} companies` +
          (summary.created_companies > 0 ? ` (${summary.created_companies} new)` : "") +
          (summary.skipped > 0 ? ` · skipped ${summary.skipped}` : "") +
          "."
        : "Import complete.";

      setSuccessMessage(message);
      onImported(json);
      setCommitting(false);
    } catch {
      setError("Failed to import rows.");
      setCommitting(false);
    }
  }

  const saveLabel =
    step === "mapping" ? "Continue to preview" : step === "preview" ? "Import to version" : undefined;

  const onSave =
    step === "mapping"
      ? () => void handleApplyColumnMapping()
      : step === "preview"
        ? () => void handleCommit()
        : undefined;

  const saveDisabled =
    step === "mapping"
      ? loading || nameColumn.trim() === ""
      : step !== "preview" || previewSummary.importSelected === 0 || blockLowImportCommit;

  return (
    <AdminDrawerShell
      title="Bulk upload Partner Alumni"
      saving={committing || loading}
      saveLabel={saveLabel}
      saveDisabled={saveDisabled}
      onClose={onClose}
      onSave={onSave}
      showSave={(step === "mapping" || step === "preview") && !successMessage}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Import companies into{" "}
          <span className="font-medium text-slate-900">{versionLabel}</span>. Upload a CSV or
          Excel file with columns <span className="font-medium">name</span>, optional{" "}
          <span className="font-medium">website</span> /{" "}
          <span className="font-medium">domain</span>, and optional{" "}
          <span className="font-medium">display_order</span>. Title rows such as{" "}
          <span className="font-medium">Partner Alumni</span> are ignored automatically. Review
          ambiguous matches before commit. Import does not change the current public version
          automatically.
        </p>

        {step === "upload" ? (
          <div>
            <label
              htmlFor="partner-alumni-bulk-file"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Spreadsheet file
            </label>
            <input
              id="partner-alumni-bulk-file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={formInputClass}
              disabled={loading}
              onChange={(event) => void handleFileChange(event)}
            />
            {loading ? <p className="mt-2 text-sm text-slate-500">Parsing and matching…</p> : null}
          </div>
        ) : null}

        {step === "mapping" ? (
          <div className="space-y-4">
            <InlineErrorBanner message="Column mapping required — we could not confidently detect company name and website columns." />

            <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <tbody>
                  {mappingSampleRows.map((row, rowIndex) => (
                    <tr key={`sample-${rowIndex}`} className="border-b border-slate-100">
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="px-2 py-1 text-slate-700">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Company name column</span>
                <select
                  className={formInputClass}
                  value={nameColumn}
                  onChange={(event) => setNameColumn(event.target.value)}
                >
                  {columnOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Website column (optional)</span>
                <select
                  className={formInputClass}
                  value={websiteColumn}
                  onChange={(event) => setWebsiteColumn(event.target.value)}
                >
                  <option value="">— None —</option>
                  {columnOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Display order column (optional)
                </span>
                <select
                  className={formInputClass}
                  value={displayOrderColumn}
                  onChange={(event) => setDisplayOrderColumn(event.target.value)}
                >
                  <option value="">— None —</option>
                  {columnOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className={secondaryCtaClass}
              disabled={loading}
              onClick={() => {
                setStep("upload");
                setFileBuffer(null);
                setError(null);
              }}
            >
              Choose another file
            </button>
          </div>
        ) : null}

        {step === "preview" ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p>
                <span className="font-medium">{parsedRowCount}</span> parsed ·{" "}
                <span className="font-medium text-emerald-800">{previewSummary.importSelected}</span>{" "}
                selected to import ·{" "}
                <span className="font-medium">{previewSummary.skipSelected}</span> skip ·{" "}
                <span className="font-medium text-amber-900">{previewSummary.review}</span> review ·{" "}
                <span className="font-medium text-sky-900">{previewSummary.createNew}</span> new
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {previewSummary.matched} matched · {previewSummary.invalid} invalid ·{" "}
                {previewSummary.onRoster} already on version · {previewSummary.duplicateInFile}{" "}
                duplicate in file
              </p>
            </div>

            {lowImportWarning ? (
              <InlineErrorBanner
                message={
                  blockLowImportCommit
                    ? `Only ${previewSummary.importSelected} of ${parsedRowCount} parsed rows are selected for import. Check column mapping or row selections before committing — import is blocked until you fix this.`
                    : `Only ${previewSummary.importSelected} of ${parsedRowCount} parsed rows are selected for import. Confirm column mapping and review-row selections before committing.`
                }
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-700">
                Review rows below before importing into this version.
              </p>
              <button
                type="button"
                className={secondaryCtaClass}
                disabled={committing}
                onClick={() => {
                  setStep("upload");
                  setPreviewRows([]);
                  setDecisions({});
                  setFileBuffer(null);
                  setError(null);
                  setSuccessMessage(null);
                }}
              >
                Choose another file
              </button>
            </div>

            <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Website</th>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Import</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row) => {
                    const decision =
                      decisions[row.row_number] ?? getDefaultPartnerAlumniBulkRowDecision(row);
                    const canImport =
                      shouldPartnerAlumniBulkImportByDefault(row.status) ||
                      row.status === "review";

                    return (
                      <tr key={row.row_number}>
                        <td className="px-3 py-2 text-slate-500">{row.row_number}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                        <td className="px-3 py-2 text-slate-600">{row.website ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{row.display_order ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>
                          {row.proposed_company_name ? (
                            <p className="mt-1 text-xs text-slate-500">
                              → {row.proposed_company_name}
                            </p>
                          ) : null}
                          {row.message ? (
                            <p className="mt-1 text-xs text-slate-500">{row.message}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {canImport ? (
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={decision.action === "import"}
                                disabled={committing}
                                onChange={(event) =>
                                  updateDecision(row.row_number, {
                                    action: event.target.checked ? "import" : "skip",
                                  })
                                }
                              />
                              Import
                            </label>
                          ) : (
                            <span className="text-xs text-slate-400">Skip</span>
                          )}
                          {row.status === "review" && decision.action === "import" ? (
                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={decision.create_new}
                                disabled={committing}
                                onChange={(event) =>
                                  updateDecision(row.row_number, {
                                    create_new: event.target.checked,
                                    company_id: event.target.checked
                                      ? null
                                      : row.proposed_company_id,
                                  })
                                }
                              />
                              Create new instead
                            </label>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {successMessage ? (
              <p className={`${feedbackSuccessClass} !py-2 !text-sm`}>{successMessage}</p>
            ) : null}
          </>
        ) : null}

        {error ? <InlineErrorBanner message={error} /> : null}

        {step === "preview" && !successMessage ? (
          <p className="text-xs text-slate-500">
            Matched and new-company rows import by default. Review rows require confirmation. Use
            Set as current separately when this version is ready for the public site.
          </p>
        ) : null}

        {successMessage ? (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </AdminDrawerShell>
  );
}
