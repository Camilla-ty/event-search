import Link from "next/link";

import { primaryCtaClass } from "@/src/lib/design/classes";

export default function SeriesHubNotFound() {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Event brand not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        This event brand does not exist or is no longer available.
      </p>
      <div className="mt-4">
        <Link href="/events" className={primaryCtaClass}>
          Back to Events
        </Link>
      </div>
    </section>
  );
}
