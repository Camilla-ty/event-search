"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo } from "react";

import { tierSectionTitle } from "./liveSponsorQaUtils";
import { LiveSponsorQARow } from "./LiveSponsorQARow";
import type { LiveSponsorRow, LiveSponsorTierGroup, SponsorMoveDirection } from "./liveSponsorTypes";

type EditionLiveSponsorsTierSectionProps = {
  containerId: string;
  group: LiveSponsorTierGroup;
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  reorderDisabled?: boolean;
};

export function EditionLiveSponsorsTierSection({
  containerId,
  group,
  onEdit,
  onRemove,
  onMove,
  reorderDisabled = false,
}: EditionLiveSponsorsTierSectionProps) {
  const sponsorIds = useMemo(
    () => group.sponsors.map((sponsor) => sponsor.id),
    [group.sponsors],
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
        {tierSectionTitle(group)}
      </header>
      <SortableContext
        id={containerId}
        items={sponsorIds}
        strategy={verticalListSortingStrategy}
      >
        <ul>
          {group.sponsors.map((row, index) => {
            const isFirstInTier = index === 0;
            const isLastInTier = index === group.sponsors.length - 1;
            const isOnlyInTier = group.sponsors.length === 1;
            return (
              <LiveSponsorQARow
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
