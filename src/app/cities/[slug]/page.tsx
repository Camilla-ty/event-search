import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type CityPageProps = {
  params: Promise<{ slug: string }>;
};

/** Legacy route — browse events via Event Explorer. */
export default async function CityPage(_props: CityPageProps) {
  redirect("/events");
}
