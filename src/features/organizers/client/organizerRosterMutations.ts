import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";

export type OrganizerLinkMutationRow = {
  id: string;
  event_editions_id: string;
  company_id: string;
  role_label: string;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type OrganizerCreateCompany = {
  id: string;
  name: string;
  domain: string | null;
};

function buildCompanyFromCreate(
  company: OrganizerCreateCompany,
): NonNullable<EditionOrganizerAdminRow["companies"]> {
  return {
    id: company.id,
    name: company.name,
    slug: null,
    domain: company.domain,
    logo_url: null,
  };
}

export function buildOrganizerRowFromCreate(
  link: OrganizerLinkMutationRow,
  company: OrganizerCreateCompany,
): EditionOrganizerAdminRow {
  return {
    ...link,
    companies: buildCompanyFromCreate(company),
  };
}

export function applyOrganizerCreate(
  organizers: readonly EditionOrganizerAdminRow[],
  link: OrganizerLinkMutationRow,
  company: OrganizerCreateCompany,
): EditionOrganizerAdminRow[] {
  return [...organizers, buildOrganizerRowFromCreate(link, company)];
}

export function applyOrganizerEdit(
  organizers: readonly EditionOrganizerAdminRow[],
  link: OrganizerLinkMutationRow,
): EditionOrganizerAdminRow[] {
  return organizers.map((row) =>
    row.id === link.id
      ? {
          ...row,
          role_label: link.role_label,
          display_order: link.display_order,
          updated_at: link.updated_at,
        }
      : row,
  );
}

export function applyOrganizerRemove(
  organizers: readonly EditionOrganizerAdminRow[],
  linkId: string,
): EditionOrganizerAdminRow[] {
  return organizers
    .filter((row) => row.id !== linkId)
    .map((row, index) => ({
      ...row,
      display_order: index + 1,
    }));
}

export function applyOrganizerReorder(
  organizers: readonly EditionOrganizerAdminRow[],
  links: readonly OrganizerLinkMutationRow[],
): EditionOrganizerAdminRow[] {
  const companiesById = new Map(organizers.map((row) => [row.id, row.companies]));

  return links.map((link) => ({
    ...link,
    companies: companiesById.get(link.id) ?? null,
  }));
}
