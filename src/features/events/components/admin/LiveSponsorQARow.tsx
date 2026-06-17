import Link from "next/link";

import { LiveSponsorBrandfetchButton } from "./LiveSponsorBrandfetchButton";
import { LiveSponsorLogoPreview } from "./LiveSponsorLogoPreview";
import type { LiveSponsorRow, SponsorMoveDirection } from "./liveSponsorTypes";

type LiveSponsorQARowProps = {
  row: LiveSponsorRow;
  positionInTier: number;
  isFirstInTier: boolean;
  isLastInTier: boolean;
  moveDisabled?: boolean;
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
};

export function LiveSponsorQARow({
  row,
  positionInTier,
  isFirstInTier,
  isLastInTier,
  moveDisabled = false,
  onEdit,
  onRemove,
  onMove,
}: LiveSponsorQARowProps) {
  const company = row.companies;
  const companyId = company?.id;
  const companyName = company?.name?.trim() || "—";
  const domain = company?.domain?.trim() || null;

  return (
    <li className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-start gap-3">
        <span
          className="mt-7 w-8 shrink-0 text-right text-xs font-medium tabular-nums text-slate-400"
          aria-label={`Position ${positionInTier} in tier`}
        >
          #{positionInTier}
        </span>
        <LiveSponsorLogoPreview
          name={companyName}
          logoUrl={company?.logo_url ?? null}
          logoSource={company?.logo_source ?? null}
        />
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <p className="font-medium text-slate-900">{companyName}</p>
        {domain ? <p className="text-sm text-slate-500">{domain}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end sm:pt-2">
        {onMove ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move up within tier"
              title="Move up within tier"
              disabled={moveDisabled || isFirstInTier}
              className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => onMove(row, "up")}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down within tier"
              title="Move down within tier"
              disabled={moveDisabled || isLastInTier}
              className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => onMove(row, "down")}
            >
              ↓
            </button>
          </span>
        ) : null}

        {companyId ? (
          <LiveSponsorBrandfetchButton
            companyId={companyId}
            companyName={companyName}
            domain={company?.domain ?? null}
            logoUrl={company?.logo_url ?? null}
            logoSource={company?.logo_source ?? null}
            logoStatus={company?.logo_status ?? null}
            disabled={moveDisabled}
          />
        ) : null}

        {onEdit ? (
          <button
            type="button"
            className="text-sm text-brand-primary hover:underline"
            onClick={() => onEdit(row)}
          >
            Edit
          </button>
        ) : null}

        {onRemove ? (
          <button
            type="button"
            className="text-sm text-red-600 hover:underline"
            onClick={() => onRemove(row)}
          >
            Remove
          </button>
        ) : null}

        {companyId ? (
          <Link
            href={`/admin/companies/${companyId}`}
            className="text-sm text-brand-primary hover:underline"
          >
            View company
          </Link>
        ) : null}
      </div>
    </li>
  );
}
