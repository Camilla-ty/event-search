import Link from "next/link";

export default function EventNotFound() {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Event not found</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        The event you are looking for does not exist or is no longer available.
      </p>
      <div className="mt-4">
        <Link
          href="/events"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500"
        >
          Back to Events Explorer
        </Link>
      </div>
    </section>
  );
}
