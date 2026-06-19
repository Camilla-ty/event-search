import { BRAND_NAME } from "@/src/lib/design/brand";

export function DiscoverHero() {
  return (
    <section className="space-y-2 border-b border-slate-200 pb-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        {BRAND_NAME}
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        Event industry intelligence — see what&apos;s coming up and what&apos;s new
        across events and sponsors.
      </p>
    </section>
  );
}
