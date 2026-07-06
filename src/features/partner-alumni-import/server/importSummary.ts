import type { PartnerAlumniImportMatchMethod } from "../types";

export type ImportSummaryRow = {
  status: string;
  match_method: string | null;
  decision_type: string | null;
  intended_member_action: string | null;
};

export type MatchMethodSummary = {
  domain: number;
  alias: number;
  website: number;
  exact_name: number;
  manual: number;
  create_new: number;
};

export type MaterializePreviewSummary = {
  companies_to_create: number;
  members_to_create: number;
  members_to_update: number;
  members_to_skip: number;
};

const MATCH_METHOD_KEYS: readonly PartnerAlumniImportMatchMethod[] = [
  "domain",
  "alias",
  "website",
  "exact_name",
  "manual",
  "create_new",
];

export function summarizeMatchMethods(rows: readonly ImportSummaryRow[]): MatchMethodSummary {
  const resolved = rows.filter((row) => row.status === "resolved");
  const counts: MatchMethodSummary = {
    domain: 0,
    alias: 0,
    website: 0,
    exact_name: 0,
    manual: 0,
    create_new: 0,
  };

  for (const row of resolved) {
    const method = row.match_method;
    if (method && (MATCH_METHOD_KEYS as readonly string[]).includes(method)) {
      counts[method as PartnerAlumniImportMatchMethod] += 1;
    }
  }

  return counts;
}

export function summarizeMaterializePreview(
  rows: readonly ImportSummaryRow[],
): MaterializePreviewSummary {
  const resolved = rows.filter((row) => row.status === "resolved");

  let companiesToCreate = 0;
  let membersToCreate = 0;
  let membersToUpdate = 0;
  let membersToSkip = 0;

  for (const row of resolved) {
    if (row.decision_type === "create_new") {
      companiesToCreate += 1;
    }

    switch (row.intended_member_action) {
      case "create_new_link":
        membersToCreate += 1;
        break;
      case "update_order":
        membersToUpdate += 1;
        break;
      case "skip":
        membersToSkip += 1;
        break;
      default:
        membersToCreate += 1;
        break;
    }
  }

  return {
    companies_to_create: companiesToCreate,
    members_to_create: membersToCreate,
    members_to_update: membersToUpdate,
    members_to_skip: membersToSkip,
  };
}
