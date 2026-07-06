import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { formatPartnerAlumniVerifiedMonth } from "@/src/features/partner-alumni/lib/formatPartnerAlumniVerifiedMonth";
import type { PublicPartnerAlumniCurrentVersion } from "@/src/features/partner-alumni/server/partnerAlumniPublic";
import { formatPrimarySourceLink } from "@/src/features/events/lib/formatEventResearchMetadata";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import { brandLinkClass } from "@/src/lib/design/classes";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

type EventPartnerAlumniSectionProps = {
  partnerAlumni: PublicPartnerAlumniCurrentVersion;
  seriesName: string | null;
};

export function EventPartnerAlumniSection({
  partnerAlumni,
  seriesName,
}: EventPartnerAlumniSectionProps) {
  const sourceLink = formatPrimarySourceLink(partnerAlumni.primary_source_url);
  const sourceCheckedLabel = partnerAlumni.source_checked_at
    ? formatPartnerAlumniVerifiedMonth(partnerAlumni.source_checked_at)
    : "Unknown";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Partner Alumni</h2>
        {seriesName ? (
          <p className="mt-2 text-sm text-slate-600">
            Long-term partners recognized by{" "}
            <span className="font-medium text-slate-900">{seriesName}</span>.
          </p>
        ) : null}

        <dl className="mt-4 space-y-3">
          {partnerAlumni.recognition_label ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-sm font-medium text-slate-700 sm:w-36">
                Recognition
              </dt>
              <dd className="text-sm text-slate-600">{partnerAlumni.recognition_label}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-sm font-medium text-slate-700 sm:w-36">
              Source checked
            </dt>
            <dd className="text-sm text-slate-600">{sourceCheckedLabel}</dd>
          </div>
          {sourceLink ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-sm font-medium text-slate-700 sm:w-36">Source</dt>
              <dd className="text-sm text-slate-600">
                <a
                  href={sourceLink.href}
                  target="_blank"
                  rel="noreferrer"
                  className={brandLinkClass}
                >
                  {sourceLink.label}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Recognized companies</h3>
        <ul className="space-y-2">
          {partnerAlumni.members.map((member) => (
            <EventPartnerAlumniListItem key={member.id} member={member} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function EventPartnerAlumniListItem({
  member,
}: {
  member: PublicPartnerAlumniCurrentVersion["members"][number];
}) {
  const company = member.company;
  const heading = company?.name?.trim() || "Unknown company";
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
        <p className="font-semibold text-slate-900">{heading}</p>
      </div>
    </div>
  );

  if (!profileHref) {
    return <li className="rounded-lg border border-slate-200 p-3">{content}</li>;
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
