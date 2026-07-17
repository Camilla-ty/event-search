import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BitcoinAsiaHubView } from "@/src/features/events/components/bitcoin-asia/BitcoinAsiaHubView";
import { BITCOIN_ASIA_HUB_PATH } from "@/src/features/events/lib/bitcoinAsiaHub";
import { getBitcoinAsiaHubPageData } from "@/src/features/events/server/bitcoinAsiaHubPublic";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import {
  getBitcoinAsiaHubIndexability,
  robotsForIndexability,
} from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getBitcoinAsiaHubPageData();
  if (!data) {
    return createNotFoundPageMetadata(BITCOIN_ASIA_HUB_PATH);
  }

  const indexability = getBitcoinAsiaHubIndexability({
    indexableEventCount: data.facts.indexableEventCount,
    distinctSponsorCount: data.facts.distinctSponsorCount,
  });

  return createPageMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    robots: robotsForIndexability(indexability),
  });
}

export default async function BitcoinAsiaHubPage() {
  const data = await getBitcoinAsiaHubPageData();
  if (!data) {
    notFound();
  }

  return <BitcoinAsiaHubView data={data} />;
}
