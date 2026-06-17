"use client";

import { useMemo, useState } from "react";

import type { CompanyLogoFields } from "@/src/lib/companies/logoTypes";
import {
  companyLogoMonogramLetter,
  resolveCompanyLogo,
} from "@/src/lib/companies/resolveCompanyLogo";

type CompanyLogoProps = {
  company: CompanyLogoFields;
  className?: string;
  imageClassName?: string;
  monogramClassName?: string;
  alt?: string;
};

export function CompanyLogo({
  company,
  className = "",
  imageClassName = "h-full w-full object-contain",
  monogramClassName = "text-2xl font-semibold text-slate-400",
  alt,
}: CompanyLogoProps) {
  const resolved = useMemo(() => resolveCompanyLogo(company), [company]);
  const [imageFailed, setImageFailed] = useState(false);

  const showMonogram = resolved.kind === "monogram" || imageFailed;
  const imageAlt =
    alt ?? (company.name?.trim() ? `${company.name.trim()} logo` : "Company logo");

  return (
    <div className={className}>
      {showMonogram ? (
        <span className={monogramClassName}>
          {companyLogoMonogramLetter(company.name)}
        </span>
      ) : (
        <img
          src={resolved.src}
          alt={imageAlt}
          className={imageClassName}
          referrerPolicy="origin"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
