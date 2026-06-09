import { redirect } from "next/navigation";

export default function LegacyNewEventPage() {
  redirect("/admin/events/editions/new");
}
