"use client";

import { useState } from "react";

import { Badge } from "@/src/components/common";
import type { BadgeProps } from "@/src/components/common/Badge";
import { companyLogoMonogramLetter } from "@/src/lib/companies/resolveCompanyLogo";

type AdminCompanyLogoCellProps = {
  name: string;
  logoUrl: string | null;
  logoSource: string | null;
};

type SourceBadge = {
  label: string;
  variant: NonNullable<BadgeProps["variant"]>;
};

function adminLogoSourceBadge(logoSource: string | null | undefined): SourceBadge | null {
  const source = logoSource?.trim().toLowerCase() ?? "";
  switch (source) {
    case "manual":
      return { label: "Manual", variant: "neutral" };
    case "brandfetch":
      return { label: "Brandfetch", variant: "accent" };
    case "storage":
      return { label: "Auto", variant: "default" };
    case "logo_dev":
      return { label: "Legacy", variant: "warning" };
    default:
      return null;
  }
}

export function AdminCompanyLogoCell({
  name,
  logoUrl,
  logoSource,
}: AdminCompanyLogoCellProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const storedLogoUrl = logoUrl?.trim() ?? "";
  const showImage = storedLogoUrl !== "" && !imageFailed;
  const badge = adminLogoSourceBadge(logoSource);

  return (
    <div className="flex min-w-[4.5rem] flex-col items-center gap-1">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={storedLogoUrl}
            alt={name.trim() ? `${name.trim()} logo` : "Company logo"}
            className="max-h-full max-w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-sm font-semibold text-slate-400">
            {companyLogoMonogramLetter(name)}
          </span>
        )}
      </div>
      {badge ? (
        <Badge variant={badge.variant} className="max-w-full truncate px-1.5 text-[10px] leading-4">
          {badge.label}
        </Badge>
      ) : null}
    </div>
  );
}
