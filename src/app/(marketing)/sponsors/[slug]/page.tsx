import { notFound } from "next/navigation";

import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import { getSponsorDetailData } from "@/src/features/sponsors/server/getSponsorDetailData";

export const dynamic = "force-dynamic";

type SponsorDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SponsorDetailPage({ params }: SponsorDetailPageProps) {
  const { slug } = await params;
  const data = await getSponsorDetailData(slug);

  if (!data) {
    notFound();
  }

  return <SponsorDetailView data={data} />;
}

