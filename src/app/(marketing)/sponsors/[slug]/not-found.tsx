import Link from "next/link";

export default function SponsorNotFound() {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Sponsor not found
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        We couldn&apos;t find a company for this URL. Sponsor profiles accept a company slug (preferred)
        or UUID for backward-compatible links.
      </p>
      <Link
        href="/sponsors"
        className="inline-flex text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
      >
        ← Browse sponsors
      </Link>
    </section>
  );
}

