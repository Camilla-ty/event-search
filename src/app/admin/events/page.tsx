import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Events section entry: land on Event Series list (no Overview hub). */
export default function AdminEventsOverviewPage() {
  redirect("/admin/events/series");
}
