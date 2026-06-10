import Link from "next/link";

export type LiveSponsorRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  companies: {
    id: string;
    name: string | null;
    slug: string | null;
    domain: string | null;
  } | null;
};

export type SponsorMoveDirection = "up" | "down";

type EditionLiveSponsorsTableProps = {
  sponsors: LiveSponsorRow[];
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  moveDisabled?: boolean;
};

function sameTier(a: LiveSponsorRow, b: LiveSponsorRow): boolean {
  return a.tier_rank === b.tier_rank;
}

export function EditionLiveSponsorsTable({
  sponsors,
  onEdit,
  onRemove,
  onMove,
  moveDisabled = false,
}: EditionLiveSponsorsTableProps) {
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
          {sponsors.map((row, index) => {
            const company = row.companies;
            const companyId = company?.id;
            const label =
              typeof row.tier_label === "string" && row.tier_label.trim() !== ""
                ? row.tier_label.trim()
                : null;
            const prev = index > 0 ? sponsors[index - 1] : undefined;
            const next = index < sponsors.length - 1 ? sponsors[index + 1] : undefined;
            const isTierStart = prev === undefined || !sameTier(prev, row);
            const isFirstInTier = isTierStart;
            const isLastInTier = next === undefined || !sameTier(row, next);
            return (
              <tr
                key={row.id}
                className={[
                  "border-b border-slate-100 last:border-0",
                  isTierStart && index > 0 ? "border-t-2 border-t-slate-200" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {company?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{company?.domain ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{label ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.tier_rank ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    {onMove ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Move up within tier"
                          title="Move up within tier"
                          disabled={moveDisabled || isFirstInTier}
                          className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => onMove(row, "up")}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Move down within tier"
                          title="Move down within tier"
                          disabled={moveDisabled || isLastInTier}
                          className="rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => onMove(row, "down")}
                        >
                          ↓
                        </button>
                      </span>
                    ) : null}
                    {onEdit ? (
                      <button
                        type="button"
                        className="text-brand-primary hover:underline"
                        onClick={() => onEdit(row)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {companyId ? (
                      <Link
                        href={`/admin/companies/${companyId}`}
                        className="text-brand-primary hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
                    {onRemove ? (
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => onRemove(row)}
                      >
                        Remove
                      </button>
                    ) : null}
                    {!onEdit && !onRemove && !companyId ? "—" : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
