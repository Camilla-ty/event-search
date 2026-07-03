import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

import type { PublicOrganizerRow } from "@/src/features/events/server/mapPublicOrganizers";

export function EventOrganizerListItem({ organizer }: { organizer: PublicOrganizerRow }) {
  const company = organizer.company;
  const heading = company?.name?.trim() || "Unknown organizer";
  const profileHref = company
    ? buildSponsorProfilePath({ slug: company.slug, id: company.id })
    : null;

  const content = (
    <div className="flex gap-3">
      <CompanyLogo
        company={companyLogoFieldsFromRow(company)}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
        monogramClassName="text-lg font-semibold text-slate-400"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-slate-900">{heading}</p>
          <span className="shrink-0 text-xs font-medium text-slate-500">
            {organizer.role_label}
          </span>
        </div>
      </div>
    </div>
  );

  if (!profileHref) {
    return (
      <li className="rounded-lg border border-slate-200 p-3">{content}</li>
    );
  }

  return (
    <li>
      <Link
        href={profileHref}
        className="block rounded-lg border border-slate-200 p-3 transition hover:border-brand-primary/40 hover:bg-brand-primary-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    </li>
  );
}
