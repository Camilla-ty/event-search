import { getHomeOverview } from "@/src/features/home/server/getHomeOverview";
import { getEventExplorerData } from "@/src/features/events/server/getEventExplorerData";
import { getSponsorSearchData } from "@/src/features/sponsors/server/getSponsorSearchData";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/common";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const overview = await getHomeOverview();
  const [eventsData, sponsorsData] = await Promise.all([
    getEventExplorerData(),
    getSponsorSearchData({}),
  ]);
  const sponsors = sponsorsData.sponsors.slice(0, 4);
  const events = eventsData.editions.slice(0, 4);
  const savedCount = 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">HandsShakes</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sponsors</CardTitle>
            <CardDescription>Total sponsors in current scope</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{sponsorsData.sponsors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Total event editions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{overview.eventEditionCount || eventsData.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved</CardTitle>
            <CardDescription>Shortlist stats</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{savedCount}</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sponsors</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sponsors.map((sponsor, index) => (
            <Card key={sponsor.id ?? `${sponsor?.companies?.name ?? "sponsor"}-${index}`}>
              <CardHeader>
                <CardTitle>{sponsor?.companies?.name ?? "Unknown Sponsor"}</CardTitle>
                <CardDescription>{sponsor?.companies?.industry ?? "Sponsor"}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Events</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>{event.start_date ?? "Date TBC"}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
