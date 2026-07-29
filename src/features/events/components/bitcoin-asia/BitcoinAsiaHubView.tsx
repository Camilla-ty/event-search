import { TopicRegionHubView } from "@/src/features/events/components/topic-region/TopicRegionHubView";
import type { BitcoinAsiaHubPageData } from "@/src/features/events/server/bitcoinAsiaHubPublic";
import type { TopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";

type BitcoinAsiaHubViewProps = {
  data: BitcoinAsiaHubPageData;
};

export function BitcoinAsiaHubView({ data }: BitcoinAsiaHubViewProps) {
  const generic: TopicRegionHubPageData = {
    ...data,
    eyebrow: "Bitcoin · Asia",
    topicName: "Bitcoin",
    regionName: "Asia",
    passesGate: true,
  };

  return <TopicRegionHubView data={generic} />;
}
