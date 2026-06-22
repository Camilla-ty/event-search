import { SponsorSearchPage } from "@/src/features/sponsors/components/search/SponsorSearchPage";
import { getSponsorDiscoveryPage } from "@/src/features/sponsors/server/getSponsorDiscoveryPage";
import { createPageMetadata } from "@/src/lib/metadata/site";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Sponsors",
  description: "Discover companies that sponsor events across EventPixels.",
  path: "/sponsors",
});

type SponsorsPageProps = {
  searchParams: Promise<{
    event?: string;
    q?: string;
    sort?: string;
    page?: string;
    industry?: string;
  }>;
};

export default async function SponsorsPage({ searchParams }: SponsorsPageProps) {
  const { event, q, sort, page } = await searchParams;
  const data = await getSponsorDiscoveryPage({
    q,
    event,
    sort,
    page,
  });

  return (
    <SponsorSearchPage
      rows={data.rows}
      total={data.total}
      params={data.params}
      eventContext={data.eventContext}
      eventUnknown={data.eventUnknown}
    />
  );
}
