import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import { PublicTopicsSection } from "@/src/features/events/components/PublicTopicsSection";
import type { PublicEventSeriesSummary } from "@/src/features/events/types/publicEdition";
import type { PublicKeywordSummary } from "@/src/features/events/types/keywords";
import { FactualSummaryParagraph } from "@/src/components/seo/FactualSummaryParagraph";
import { brandLinkClass } from "@/src/lib/design/classes";
import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";

type SeriesHubHeaderProps = {
  series: PublicEventSeriesSummary;
  topics?: ReadonlyArray<PublicKeywordSummary>;
  factualSummary?: string | null;
};

export function SeriesHubHeader({
  series,
  topics = [],
  factualSummary = null,
}: SeriesHubHeaderProps) {
  const websiteDisplay = formatPublicCompanyWebsite({
    website: series.website_url,
    domain: null,
  });

  return (
    <header className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[auto_1fr] md:items-start">
      <SeriesLogo
        series={series}
        className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        imageClassName="max-h-full max-w-full object-contain p-2"
        monogramClassName="text-2xl font-semibold text-slate-400"
      />

      <div className="min-w-0 space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">{series.name}</h1>
        {series.description ? (
          <p className="text-sm text-slate-600">{series.description}</p>
        ) : (
          <p className="text-sm text-slate-500">
            Recurring event brand — browse all editions below.
          </p>
        )}
        {factualSummary ? (
          <FactualSummaryParagraph summary={factualSummary} />
        ) : null}
        {websiteDisplay ? (
          <p className="text-sm">
            <a
              href={websiteDisplay.href}
              target="_blank"
              rel="noreferrer"
              className={brandLinkClass}
            >
              {websiteDisplay.label}
            </a>
          </p>
        ) : null}
        <PublicTopicsSection topics={topics} />
      </div>
    </header>
  );
}
