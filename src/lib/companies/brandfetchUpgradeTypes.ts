export type BrandfetchUpgradeSkipReason =
  | "manual"
  | "already_brandfetch"
  | "missing_domain"
  | "invalid_domain"
  | "company_not_found";

export type BrandfetchUpgradeFailureReason =
  | "brand_not_found"
  | "no_logo_asset"
  | "download_failed"
  | "upload_failed"
  | "db_update_failed"
  | "brandfetch_api_error";

export type BrandfetchUpgradeItemResult =
  | { companyId: string; companyName: string; status: "upgraded"; logoUrl: string }
  | {
      companyId: string;
      companyName: string;
      status: "skipped";
      reason: BrandfetchUpgradeSkipReason;
    }
  | {
      companyId: string;
      companyName: string;
      status: "failed";
      reason: BrandfetchUpgradeFailureReason;
      message?: string;
    };

export type BrandfetchUpgradeBatchResult = {
  results: BrandfetchUpgradeItemResult[];
  upgraded: number;
  skipped: number;
  failed: number;
};

export type BrandfetchUpgradeApiResponse =
  | ({ ok: true } & BrandfetchUpgradeBatchResult)
  | { ok: false; error: string };
