"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

import { LiveSponsorLogoPreview } from "./LiveSponsorLogoPreview";
import type { LiveSponsorRow, SponsorMoveDirection } from "./liveSponsorTypes";

type LiveSponsorQARowProps = {
  row: LiveSponsorRow;
  positionInTier: number;
  isFirstInTier: boolean;
  isLastInTier: boolean;
  isOnlyInTier?: boolean;
  reorderDisabled?: boolean;
  onEdit?: (row: LiveSponsorRow) => void;
  onLogo?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
};

export function LiveSponsorQARow({
  row,
  positionInTier,
  isFirstInTier,
  isLastInTier,
  isOnlyInTier = false,
  reorderDisabled = false,
  onEdit,
  onLogo,
  onRemove,
  onMove,
}: LiveSponsorQARowProps) {
  const dragDisabled = reorderDisabled || isOnlyInTier;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: dragDisabled,
  });

  const company = row.companies;
  const companyId = company?.id;
  const companyName = company?.name?.trim() || "—";
  const domain = company?.domain?.trim() || null;

  const reorderBlockedTitle = reorderDisabled
    ? "Clear search to reorder sponsors"
    : isOnlyInTier
      ? "Add another sponsor to this tier to reorder"
      : "Drag to reorder within tier";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "flex flex-col gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:flex-row sm:items-start",
        isDragging ? "relative z-10 bg-white shadow-sm" : "",
      ].join(" ")}
    >
      <div className="flex shrink-0 items-start gap-2">
        <div
          ref={setActivatorNodeRef}
          aria-label={reorderBlockedTitle}
          title={reorderBlockedTitle}
          className={[
            "mt-7 shrink-0 rounded px-1 py-0.5 text-slate-400 select-none",
            dragDisabled
              ? "cursor-not-allowed opacity-30"
              : "cursor-grab touch-none hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing",
          ].join(" ")}
          {...attributes}
          {...listeners}
          tabIndex={dragDisabled ? -1 : 0}
          aria-disabled={dragDisabled}
        >
          ⋮⋮
        </div>
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
              title={
                reorderDisabled ? "Clear search to reorder sponsors" : "Move up within tier"
              }
              disabled={reorderDisabled || isFirstInTier}
              className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => onMove(row, "up")}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move down within tier"
              title={
                reorderDisabled ? "Clear search to reorder sponsors" : "Move down within tier"
              }
              disabled={reorderDisabled || isLastInTier}
              className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => onMove(row, "down")}
            >
              ↓
            </button>
          </span>
        ) : null}

        {companyId && onLogo ? (
          <button
            type="button"
            className="text-sm text-brand-primary hover:underline"
            onClick={() => onLogo(row)}
          >
            Logo
          </button>
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
