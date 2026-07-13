import { redirect } from "next/navigation";

import { EventExplorerPage } from "@/src/features/events/components/explorer/EventExplorerPage";
import { getEventExplorerPage } from "@/src/features/events/server/getEventExplorerPage";
import { buildEventExplorerPath } from "@/src/features/events/server/eventExplorerParams";
import { createPageMetadata } from "@/src/lib/metadata/site";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Events",
  description: "Discover and analyze events, sponsors, and opportunities across the industry.",
  path: "/events",
});

type EventsPageProps = {
  searchParams: Promise<{
    q?: string;
    industry?: string;
    region?: string | string[];
    type?: string;
    start?: string;
    end?: string;
    topic?: string | string[];
    sort?: string;
    page?: string;
  }>;
};

function toEventExplorerSearchParams(
  raw: Awaited<EventsPageProps["searchParams"]>,
): URLSearchParams {
  const params = new URLSearchParams();

  const entries: Array<[string, string | string[] | undefined]> = [
    ["q", raw.q],
    ["industry", raw.industry],
    ["type", raw.type],
    ["start", raw.start],
    ["end", raw.end],
    ["sort", raw.sort],
    ["page", raw.page],
  ];

  for (const [key, value] of entries) {
    if (typeof value !== "string" || value === "") continue;
    params.set(key, value);
  }

  const regionValues =
    raw.region === undefined ? [] : Array.isArray(raw.region) ? raw.region : [raw.region];
  for (const region of regionValues) {
    if (region !== "") params.append("region", region);
  }

  const topicValues = raw.topic === undefined ? [] : Array.isArray(raw.topic) ? raw.topic : [raw.topic];
  for (const topic of topicValues) {
    params.append("topic", topic);
  }

  return params;
}

export default async function EventsPageRoute({ searchParams }: EventsPageProps) {
  const raw = await searchParams;
  const urlParams = toEventExplorerSearchParams(raw);
  const data = await getEventExplorerPage({
    q: urlParams.get("q"),
    regions: urlParams.getAll("region"),
    start: urlParams.get("start"),
    end: urlParams.get("end"),
    topics: urlParams.getAll("topic"),
    sort: urlParams.get("sort"),
    page: urlParams.get("page"),
  });

  if (data.pageWasClamped) {
    redirect(buildEventExplorerPath(data.params));
  }

  return <EventExplorerPage initial={data} />;
}
