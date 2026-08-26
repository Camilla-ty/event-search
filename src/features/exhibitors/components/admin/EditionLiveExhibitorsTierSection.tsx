"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo } from "react";

import {
  formatExhibitorTierHeading,
  type LiveExhibitorTierGroup,
} from "@/src/features/exhibitors/lib/groupExhibitorsByTier";
import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import type { ExhibitorMoveDirection } from "@/src/lib/validation/eventExhibitor";

import { LiveExhibitorQARow } from "./LiveExhibitorQARow";

type EditionLiveExhibitorsTierSectionProps = {
  containerId: string;
  group: LiveExhibitorTierGroup;
  onEdit?: (row: LiveExhibitorRow) => void;
  onRemove?: (row: LiveExhibitorRow) => void;
  onMove?: (row: LiveExhibitorRow, direction: ExhibitorMoveDirection) => void;
  reorderDisabled?: boolean;
};

export function EditionLiveExhibitorsTierSection({
  containerId,
  group,
  onEdit,
  onRemove,
  onMove,
  reorderDisabled = false,
}: EditionLiveExhibitorsTierSectionProps) {
  const exhibitorIds = useMemo(
    () => group.exhibitors.map((exhibitor) => exhibitor.id),
    [group.exhibitors],
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
        {formatExhibitorTierHeading(group)}
      </header>
      <SortableContext
        id={containerId}
        items={exhibitorIds}
        strategy={verticalListSortingStrategy}
      >
        <ul>
          {group.exhibitors.map((row, index) => {
            const isFirstInTier = index === 0;
            const isLastInTier = index === group.exhibitors.length - 1;
            const isOnlyInTier = group.exhibitors.length === 1;
            return (
              <LiveExhibitorQARow
                key={row.id}
                row={row}
                positionInTier={index + 1}
                isFirstInTier={isFirstInTier}
                isLastInTier={isLastInTier}
                isOnlyInTier={isOnlyInTier}
                reorderDisabled={reorderDisabled}
                onEdit={onEdit}
                onRemove={onRemove}
                onMove={onMove}
              />
            );
          })}
        </ul>
      </SortableContext>
    </section>
  );
}
