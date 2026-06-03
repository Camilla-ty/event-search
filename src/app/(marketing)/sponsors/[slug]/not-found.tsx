import Link from "next/link";

import { brandLinkClass } from "@/src/lib/design/classes";

export default function SponsorNotFound() {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Sponsor not found</h1>
      <p className="text-sm text-slate-600">
        We couldn&apos;t find a company for this URL. Sponsor profiles accept a company slug
        (preferred) or UUID for backward-compatible links.
      </p>
      <Link href="/sponsors" className={`text-sm ${brandLinkClass}`}>
        ← Browse sponsors
      </Link>
    </section>
  );
}
