"use client";

import { useState } from "react";

import { Badge } from "@/src/components/common";
import type { BadgeProps } from "@/src/components/common/Badge";
import { companyLogoMonogramLetter } from "@/src/lib/companies/resolveCompanyLogo";

type LiveSponsorLogoPreviewProps = {
  name: string;
  logoUrl: string | null;
  logoSource: string | null;
};

type SourceBadge = {
  label: string;
  variant: NonNullable<BadgeProps["variant"]>;
};

function logoSourceBadge(logoSource: string | null | undefined): SourceBadge | null {
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

export function LiveSponsorLogoPreview({
  name,
  logoUrl,
  logoSource,
}: LiveSponsorLogoPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const storedLogoUrl = logoUrl?.trim() ?? "";
  const showImage = storedLogoUrl !== "" && !imageFailed;
  const badge = logoSourceBadge(logoSource);
  const missingLogo = !showImage;

  return (
    <div className="flex w-20 shrink-0 flex-col items-center gap-1.5">
      <div
        className={[
          "flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-white p-2",
          missingLogo ? "border-dashed border-slate-300" : "border-slate-200",
        ].join(" ")}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={storedLogoUrl}
            alt={name.trim() ? `${name.trim()} logo` : "Company logo"}
            className="max-h-full max-w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-xl font-semibold text-slate-400">
            {companyLogoMonogramLetter(name)}
          </span>
        )}
      </div>
      {badge ? (
        <Badge variant={badge.variant} className="max-w-full truncate px-1.5 text-[10px] leading-4">
          {badge.label}
        </Badge>
      ) : missingLogo ? (
        <span className="text-[10px] font-medium text-slate-400">No logo</span>
      ) : null}
    </div>
  );
}
