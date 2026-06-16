import Link from "next/link";

import { AdminCompanyLogoCell } from "@/src/features/companies/components/admin/AdminCompanyLogoCell";

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
    logo_url: string | null;
    logo_source: string | null;
    logo_status: string | null;
  } | null;
};

export type SponsorMoveDirection = "up" | "down";

type EditionLiveSponsorsTableProps = {
  sponsors: LiveSponsorRow[];
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  moveDisabled?: boolean;
  selectable?: boolean;
  selectedCompanyIds?: ReadonlySet<string>;
  onToggleCompany?: (companyId: string, checked: boolean) => void;
  onToggleAllCompanies?: (checked: boolean) => void;
  allCompanyIds?: readonly string[];
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
  selectable = false,
  selectedCompanyIds,
  onToggleCompany,
  onToggleAllCompanies,
  allCompanyIds = [],
}: EditionLiveSponsorsTableProps) {
  if (sponsors.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        No live sponsors on this edition yet.
      </p>
    );
  }

  const companyIds = allCompanyIds.length > 0 ? allCompanyIds : sponsors.flatMap((row) => {
    const companyId = row.companies?.id;
    return typeof companyId === "string" && companyId !== "" ? [companyId] : [];
  });
  const allSelected =
    companyIds.length > 0 &&
    selectedCompanyIds !== undefined &&
    companyIds.every((companyId) => selectedCompanyIds.has(companyId));
  const someSelected =
    selectedCompanyIds !== undefined &&
    selectedCompanyIds.size > 0 &&
    !allSelected;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {selectable ? (
              <th className="w-10 px-3 py-3 font-medium">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  aria-label="Select all sponsors"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = someSelected;
                    }
                  }}
                  onChange={(event) => onToggleAllCompanies?.(event.target.checked)}
                />
              </th>
            ) : null}
            <th className="w-20 px-4 py-3 font-medium">Logo</th>
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
            const companyName = company?.name ?? "—";
            const label =
              typeof row.tier_label === "string" && row.tier_label.trim() !== ""
                ? row.tier_label.trim()
                : null;
            const prev = index > 0 ? sponsors[index - 1] : undefined;
            const next = index < sponsors.length - 1 ? sponsors[index + 1] : undefined;
            const isTierStart = prev === undefined || !sameTier(prev, row);
            const isFirstInTier = isTierStart;
            const isLastInTier = next === undefined || !sameTier(row, next);
            const checked =
              typeof companyId === "string" &&
              companyId !== "" &&
              selectedCompanyIds?.has(companyId) === true;

            return (
              <tr
                key={row.id}
                className={[
                  "border-b border-slate-100 last:border-0",
                  isTierStart && index > 0 ? "border-t-2 border-t-slate-200" : "",
                ].join(" ")}
              >
                {selectable ? (
                  <td className="px-3 py-3 align-top">
                    {companyId ? (
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        aria-label={`Select ${companyName}`}
                        checked={checked}
                        onChange={(event) =>
                          onToggleCompany?.(companyId, event.target.checked)
                        }
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className="px-4 py-3 align-top">
                  <AdminCompanyLogoCell
                    name={companyName}
                    logoUrl={company?.logo_url ?? null}
                    logoSource={company?.logo_source ?? null}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{companyName}</td>
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
