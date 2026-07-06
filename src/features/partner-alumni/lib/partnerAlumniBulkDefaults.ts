import type { PartnerAlumniBulkPreviewRow } from "@/src/features/partner-alumni/server/partnerAlumniBulkImport";

export type PartnerAlumniBulkRowDecision = {
  action: "import" | "skip";
  company_id: string | null;
  create_new: boolean;
};

/** Rows that import without explicit user opt-in during preview. */
export function shouldPartnerAlumniBulkImportByDefault(
  status: PartnerAlumniBulkPreviewRow["status"],
): boolean {
  return status === "matched" || status === "create_new";
}

export function getDefaultPartnerAlumniBulkRowDecision(
  row: PartnerAlumniBulkPreviewRow,
): PartnerAlumniBulkRowDecision {
  if (row.status === "matched") {
    return {
      action: "import",
      company_id: row.proposed_company_id,
      create_new: false,
    };
  }

  if (row.status === "create_new") {
    return {
      action: "import",
      company_id: null,
      create_new: true,
    };
  }

  if (row.status === "review" && row.proposed_company_id) {
    return {
      action: "skip",
      company_id: row.proposed_company_id,
      create_new: false,
    };
  }

  return {
    action: "skip",
    company_id: null,
    create_new: false,
  };
}

export function buildPartnerAlumniBulkCommitPayloadRow(
  row: PartnerAlumniBulkPreviewRow,
  decision: PartnerAlumniBulkRowDecision,
): {
  row_number: number;
  action: "import" | "skip";
  name: string;
  website: string | null;
  display_order: number | null;
  company_id: string | null;
  create_new?: boolean;
} {
  const importRow = decision.action === "import";
  const createNew = importRow && (decision.create_new || row.status === "create_new");

  return {
    row_number: row.row_number,
    action: decision.action,
    name: row.name,
    website: row.website,
    display_order: row.display_order,
    company_id: createNew ? null : decision.company_id,
    ...(createNew ? { create_new: true as const } : {}),
  };
}

export function shouldCreateCompanyOnPartnerAlumniBulkImport(row: {
  action: "import" | "skip";
  company_id?: string | null;
  create_new?: boolean;
}): boolean {
  if (row.action !== "import") return false;
  if (typeof row.company_id === "string" && row.company_id.trim() !== "") return false;
  return true;
}
