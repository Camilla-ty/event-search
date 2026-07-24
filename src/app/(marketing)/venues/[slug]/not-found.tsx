import Link from "next/link";

import { brandLinkClass } from "@/src/lib/design/classes";

export default function VenueNotFound() {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Venue not found</h1>
      <p className="text-sm text-slate-600">
        We couldn&apos;t find a public venue for this URL. Venues accept a slug
        (preferred) or UUID for backward-compatible links.
      </p>
      <Link href="/events" className={`text-sm ${brandLinkClass}`}>
        ← Back to Events
      </Link>
    </section>
  );
}
