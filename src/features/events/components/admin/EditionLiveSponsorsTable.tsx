import Link from "next/link";

type LiveSponsorRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
  companies: {
    id: string;
    name: string | null;
    slug: string | null;
    domain: string | null;
  } | null;
};

type EditionLiveSponsorsTableProps = {
  sponsors: LiveSponsorRow[];
};

export function EditionLiveSponsorsTable({ sponsors }: EditionLiveSponsorsTableProps) {
  if (sponsors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        No live sponsors on this edition yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Domain</th>
            <th className="px-4 py-3 font-medium">Tier label</th>
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sponsors.map((row) => {
            const company = row.companies;
            const companyId = company?.id;
            const label =
              typeof row.tier_label === "string" && row.tier_label.trim() !== ""
                ? row.tier_label.trim()
                : null;
            return (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {company?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{company?.domain ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{label ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.tier_rank ?? "—"}</td>
                <td className="px-4 py-3">
                  {companyId ? (
                    <Link
                      href={`/admin/companies/${companyId}`}
                      className="text-brand-primary hover:underline"
                    >
                      View
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
