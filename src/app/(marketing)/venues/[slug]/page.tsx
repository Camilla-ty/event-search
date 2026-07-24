import Link from "next/link";
import { notFound } from "next/navigation";

import { VenueEditionsList } from "@/src/features/venues/components/VenueEditionsList";
import { VenueHubHeader } from "@/src/features/venues/components/VenueHubHeader";
import { getVenueHubData } from "@/src/features/venues/server/getVenueHubData";
import { buildVenueSummary } from "@/src/lib/content/factualSummary";
import { brandLinkClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type VenueHubPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function VenueHubPage({ params }: VenueHubPageProps) {
  const { slug } = await params;
  const data = await getVenueHubData(slug);

  if (!data) {
    notFound();
  }

  const factualSummary = buildVenueSummary({
    name: data.venue.name,
    locationLabel: data.venue.locationLabel,
    editions: data.editions.map((edition) => ({
      name: edition.name,
      year: edition.year,
      startDate: edition.start_date,
      endDate: edition.end_date,
      locationLabel: edition.locationLabel,
    })),
  });

  const hasUpcoming = data.upcoming.length > 0;

  return (
    <section className="space-y-8">
      <Link href="/events" className={`text-sm ${brandLinkClass}`}>
        ← Back to Events
      </Link>

      <VenueHubHeader venue={data.venue} factualSummary={factualSummary} />

      {hasUpcoming ? (
        <div className="space-y-6">
          <VenueEditionsList title="Upcoming" editions={data.upcoming} />
          {data.past.length > 0 ? (
            <VenueEditionsList title="Past" editions={data.past} />
          ) : null}
        </div>
      ) : (
        <VenueEditionsList
          title="Events at this venue"
          editions={data.past}
        />
      )}
    </section>
  );
}
