import Link from "next/link";

type SameBrandSeriesSummary = {
  id: string;
  name: string;
  slug: string;
};

type CompanySameBrandSeriesSectionProps = {
  series: SameBrandSeriesSummary | null;
};

export function CompanySameBrandSeriesSection({
  series,
}: CompanySameBrandSeriesSectionProps) {
  return (
    <div className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Same-brand Event Series</h2>
      <p className="mb-3 text-sm text-slate-500">
        Read-only. Links a Company profile to an Event Series that represents the{" "}
        <span className="font-medium text-slate-700">same brand</span> — not organizer, owner,
        or operator. Manage the link on the Event Series admin page.
      </p>
      {series === null ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No same-brand Event Series linked.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Event Series</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link
                    href={`/admin/events/series/${series.id}`}
                    className="text-brand-primary hover:underline"
                  >
                    {series.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{series.slug}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/events/series/${series.id}`}
                    className="text-brand-primary hover:underline"
                  >
                    Manage link
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
