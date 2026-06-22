import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import { getSponsorDetailData } from "@/src/features/sponsors/server/getSponsorDetailData";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type SponsorDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: SponsorDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSponsorDetailData(slug, { isAuthenticated: false });
  if (!data?.company) {
    return createPageMetadata({ title: "Sponsor not found", path: `/sponsors/${slug}` });
  }
  const name = data.company.name?.trim() || "Sponsor";
  const industry = data.company.industry?.trim();
  const description = industry
    ? `${name} — ${industry}. Company and sponsor intelligence on EventPixels.`
    : `${name}. Company and sponsor intelligence on EventPixels.`;
  const profileSlug = data.company.slug?.trim() || slug;
  return createPageMetadata({
    title: name,
    description,
    path: `/sponsors/${profileSlug}`,
  });
}

export default async function SponsorDetailPage({ params }: SponsorDetailPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getSponsorDetailData(slug, {
    isAuthenticated: user !== null,
  });

  if (!data) {
    notFound();
  }

  return <SponsorDetailView data={data} />;
}
