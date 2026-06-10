import type { LogoSource, LogoStatus } from "@/src/lib/companies/logoTypes";

export type InitialLogoMetadata = {
  logo_source: LogoSource;
  logo_status: LogoStatus;
};

export function initialLogoMetadata(params: {
  logo_url: string | null | undefined;
  domain: string | null | undefined;
}): InitialLogoMetadata {
  if (params.logo_url?.trim()) {
    return { logo_source: "manual", logo_status: "ok" };
  }

  if (params.domain?.trim()) {
    return { logo_source: "logo_dev", logo_status: "pending" };
  }

  return { logo_source: "none", logo_status: "skipped" };
}
