import type { CompanyAdminRow } from "@/src/features/companies/server/companyAdmin";
import { getCompanyAdminById } from "@/src/features/companies/server/companyAdmin";
import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import type { MergeWizardPrefill } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

function toPickerOption(company: CompanyAdminRow): MergeCompanyPickerOption {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    domain: company.domain,
    website: company.website,
    logo_url: company.logo_url,
    sponsor_link_count: 0,
    matched_alias: null,
    created_at: company.created_at,
  };
}

export async function buildMergeWizardPrefill(input: {
  canonicalId?: string;
  duplicateId?: string;
  mode?: string;
}): Promise<MergeWizardPrefill> {
  const canonicalRaw = input.canonicalId?.trim() ?? "";
  const duplicateRaw = input.duplicateId?.trim() ?? "";
  const mode = input.mode === "into" || input.mode === "away" ? input.mode : null;

  const [canonicalCompany, duplicateCompany] = await Promise.all([
    canonicalRaw !== "" && isUuid(canonicalRaw)
      ? getCompanyAdminById(canonicalRaw.toLowerCase())
      : Promise.resolve(null),
    duplicateRaw !== "" && isUuid(duplicateRaw)
      ? getCompanyAdminById(duplicateRaw.toLowerCase())
      : Promise.resolve(null),
  ]);

  return {
    canonical:
      canonicalCompany && canonicalCompany.status !== "merged"
        ? toPickerOption(canonicalCompany)
        : null,
    duplicate:
      duplicateCompany && duplicateCompany.status !== "merged"
        ? toPickerOption(duplicateCompany)
        : null,
    lockCanonical: mode === "into" && canonicalCompany !== null,
    lockDuplicate: mode === "away" && duplicateCompany !== null,
  };
}
