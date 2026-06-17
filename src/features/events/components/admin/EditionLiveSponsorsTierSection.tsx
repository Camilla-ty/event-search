"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo } from "react";

import { reorderLinkIdsByDrag } from "./liveSponsorReorderClient";
import { tierSectionTitle } from "./liveSponsorQaUtils";
import { LiveSponsorQARow } from "./LiveSponsorQARow";
import type { LiveSponsorRow, LiveSponsorTierGroup, SponsorMoveDirection } from "./liveSponsorTypes";

type EditionLiveSponsorsTierSectionProps = {
  group: LiveSponsorTierGroup;
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  onReorderTier?: (tierRank: number | null, orderedLinkIds: readonly string[]) => void;
  reorderDisabled?: boolean;
};

export function EditionLiveSponsorsTierSection({
  group,
  onEdit,
  onRemove,
  onMove,
  onReorderTier,
  reorderDisabled = false,
}: EditionLiveSponsorsTierSectionProps) {
  const sponsorIds = useMemo(
    () => group.sponsors.map((sponsor) => sponsor.id),
    [group.sponsors],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (reorderDisabled || !onReorderTier) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const nextOrder = reorderLinkIdsByDrag(
      sponsorIds,
      String(active.id),
      String(over.id),
    );
    if (nextOrder === null) {
      return;
    }

    onReorderTier(group.tierRank, nextOrder);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
        {tierSectionTitle(group)}
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sponsorIds} strategy={verticalListSortingStrategy}>
          <ul>
            {group.sponsors.map((row, index) => {
              const isFirstInTier = index === 0;
              const isLastInTier = index === group.sponsors.length - 1;
              return (
                <LiveSponsorQARow
                  key={row.id}
                  row={row}
                  positionInTier={index + 1}
                  isFirstInTier={isFirstInTier}
                  isLastInTier={isLastInTier}
                  reorderDisabled={reorderDisabled}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  onMove={onMove}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}
