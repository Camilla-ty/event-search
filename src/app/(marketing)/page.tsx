import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/common";
import { getHomeOverview } from "@/src/features/home/server/getHomeOverview";
import { getEventExplorerData } from "@/src/features/events/server/getEventExplorerData";
import { getSponsorSearchData } from "@/src/features/sponsors/server/getSponsorSearchData";
import type { SponsorRecord } from "@/src/features/sponsors/components/search/types";
import { BRAND_NAME } from "@/src/lib/design/brand";
import { brandLinkClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { createPageMetadata } from "@/src/lib/metadata/site";
import {
  buildEventDetailPath,
  buildSponsorProfilePath,
} from "@/src/lib/routes/explorerUrls";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Home",
  description:
    `Discover events, sponsors, and companies with ${BRAND_NAME} event industry intelligence.`,
  path: "/",
});

function toPreviewSponsor(
  sponsor: Awaited<ReturnType<typeof getSponsorSearchData>>["sponsors"][number],
): SponsorRecord {
  const company = sponsor.companies;
  const extended =
    company && typeof company === "object"
      ? (company as {
          id?: string | null;
          slug?: string | null;
          name?: string | null;
          industry?: string | null;
          location?: string | null;
        })
      : null;
  return {
    id: String(sponsor.id),
    tier_rank: sponsor.tier_rank ?? null,
    tier_label: typeof sponsor.tier_label === "string" ? sponsor.tier_label : null,
    companies: extended
      ? {
          id: extended.id ?? null,
          slug: extended.slug ?? null,
          name: extended.name ?? null,
          industry: extended.industry ?? null,
          location:
            (company && typeof company === "object"
              ? formatLocationFromCityEmbed(
                  (company as { cities?: unknown }).cities,
                )
              : "") ||
            extended.location ||
            null,
        }
      : null,
  };
}

export default async function HomePage() {
  const overview = await getHomeOverview();
  const [eventsData, sponsorsData] = await Promise.all([
    getEventExplorerData(),
    getSponsorSearchData({}),
  ]);
  const sponsors = sponsorsData.sponsors.slice(0, 4).map(toPreviewSponsor);
  const events = eventsData.editions.slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="space-y-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {BRAND_NAME}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Event industry intelligence — discover, analyze, and search events, sponsors, and
          companies.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/sponsors" className="block transition hover:opacity-95">
          <Card className="h-full transition hover:border-brand-primary/30">
            <CardHeader>
              <CardTitle>Sponsors</CardTitle>
              <CardDescription>Total sponsors in current scope</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">
                {sponsorsData.sponsors.length}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/events" className="block transition hover:opacity-95">
          <Card className="h-full transition hover:border-brand-primary/30">
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Total event editions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">
                {overview.eventEditionCount || eventsData.total}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card className="h-full opacity-90">
          <CardHeader>
            <CardTitle>Saved</CardTitle>
            <CardDescription>Shortlist — coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Not available yet</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Sponsors</h2>
          <Link href="/sponsors" className={`text-sm ${brandLinkClass}`}>
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sponsors.map((sponsor) => {
            const href = sponsor.companies
              ? buildSponsorProfilePath(sponsor.companies)
              : null;
            const card = (
              <Card className="h-full transition hover:border-brand-primary/30">
                <CardHeader>
                  <CardTitle>{sponsor.companies?.name ?? "Unknown Sponsor"}</CardTitle>
                  <CardDescription>
                    {sponsor.companies?.industry ?? "Sponsor"}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
            return href ? (
              <Link key={sponsor.id} href={href} className="block">
                {card}
              </Link>
            ) : (
              <div key={sponsor.id}>{card}</div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Events</h2>
          <Link href="/events" className={`text-sm ${brandLinkClass}`}>
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {events.map((event) => {
            const href = buildEventDetailPath({
              slug: event.slug ?? null,
              id: event.id != null ? String(event.id) : null,
            });
            const card = (
              <Card className="h-full transition hover:border-brand-primary/30">
                <CardHeader>
                  <CardTitle>{event.name ?? "Untitled Event"}</CardTitle>
                  <CardDescription>{event.start_date ?? "Date TBC"}</CardDescription>
                </CardHeader>
              </Card>
            );
            const key = event.id != null ? String(event.id) : "event-unknown";
            return href ? (
              <Link key={key} href={href} className="block">
                {card}
              </Link>
            ) : (
              <div key={key}>{card}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
