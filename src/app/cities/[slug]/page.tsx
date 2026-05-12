import { getEventsByCity } from "@/src/lib/queries/cities";

export const dynamic = "force-dynamic";

type CityPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params;
  const events = await getEventsByCity(slug);

  return (
    <main>
      <h1>City</h1>
      <p>City slug/id: {slug}</p>
      <p>Events in city:</p>
      <pre>{JSON.stringify(events, null, 2)}</pre>
    </main>
  );
}
