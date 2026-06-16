import type {
  BrandfetchUpgradeFailureReason,
  BrandfetchUpgradeSkipReason,
} from "@/src/lib/companies/brandfetchUpgradeTypes";

const SKIP_MESSAGES: Record<BrandfetchUpgradeSkipReason, string> = {
  manual: "Manual logos are not replaced by Brandfetch.",
  already_brandfetch: "This company already has a Brandfetch logo stored.",
  missing_domain: "This company has no domain for Brandfetch lookup.",
  invalid_domain: "This company domain is not valid for Brandfetch lookup.",
  company_not_found: "Company not found.",
};

const FAILURE_MESSAGES: Record<BrandfetchUpgradeFailureReason, string> = {
  brand_not_found: "Brandfetch has no brand data for this domain.",
  no_logo_asset: "Brandfetch returned no usable logo asset.",
  download_failed: "Could not download the logo from Brandfetch.",
  upload_failed: "Could not upload the logo to storage.",
  db_update_failed: "The logo was fetched but could not be saved.",
  brandfetch_api_error: "Brandfetch API request failed.",
};

export function brandfetchUpgradeSkipMessage(reason: BrandfetchUpgradeSkipReason): string {
  return SKIP_MESSAGES[reason];
}

export function brandfetchUpgradeFailureMessage(
  reason: BrandfetchUpgradeFailureReason,
  detail?: string,
): string {
  const base = FAILURE_MESSAGES[reason];
  if (!detail) return base;
  return `${base} (${detail})`;
}
