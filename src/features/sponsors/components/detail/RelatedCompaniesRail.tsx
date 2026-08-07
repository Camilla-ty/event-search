import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import type { SponsorDetailData } from "@/src/features/sponsors/server/types";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

type RelatedCompany = SponsorDetailData["relatedCompanies"][number];

/**
 * Light discovery rail for public related companies.
 * Always a horizontal card rail — fewer cards when N is small; scroll when overflowing.
 */
export function RelatedCompaniesRail({
  relatedCompanies,
}: {
  relatedCompanies: RelatedCompany[];
}) {
  if (relatedCompanies.length === 0) return null;

  return (
    <section aria-labelledby="related-companies-heading" className="space-y-3">
      <h2
        id="related-companies-heading"
        className="text-base font-semibold text-slate-900"
      >
        Related Companies
      </h2>

      <ul className="flex gap-3 overflow-x-auto pb-1 pe-5 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory">
        {relatedCompanies.map((related) => {
          const href = buildSponsorProfilePath(related);
          if (href === null) return null;
          const name =
            typeof related.name === "string" && related.name.trim() !== ""
              ? related.name.trim()
              : "Company";

          return (
            <li
              key={related.id}
              className="w-[8.75rem] shrink-0 snap-start sm:w-[9.5rem]"
            >
              <Link
                href={href}
                className="flex h-full flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <CompanyLogo
                  company={companyLogoFieldsFromRow(related)}
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                />
                <span className="line-clamp-2 w-full text-sm font-medium leading-snug text-slate-900">
                  {name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
