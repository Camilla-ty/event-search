"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMemo } from "react";

import { EditionLiveSponsorsTierSection } from "./EditionLiveSponsorsTierSection";
import { groupSponsorsByTier } from "./liveSponsorQaUtils";
import { reorderLinkIdsByDrag } from "./liveSponsorReorderClient";
import type { LiveSponsorRow, LiveSponsorTierGroup, SponsorMoveDirection } from "./liveSponsorTypes";

type EditionLiveSponsorsQARosterProps = {
  sponsors: LiveSponsorRow[];
  onEdit?: (row: LiveSponsorRow) => void;
  onLogo?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  onReorderTier?: (tierRank: number | null, orderedLinkIds: readonly string[]) => void;
  reorderDisabled?: boolean;
  emptySearch?: boolean;
};

function tierContainerId(group: LiveSponsorTierGroup): string {
  return group.tierRank === null ? "tier-unranked" : `tier-${group.tierRank}`;
}

function findTierGroupForLinkId(
  tierGroups: readonly LiveSponsorTierGroup[],
  linkId: string,
): LiveSponsorTierGroup | null {
  for (const group of tierGroups) {
    if (group.sponsors.some((sponsor) => sponsor.id === linkId)) {
      return group;
    }
  }
  return null;
}

export function EditionLiveSponsorsQARoster({
  sponsors,
  onEdit,
  onLogo,
  onRemove,
  onMove,
  onReorderTier,
  reorderDisabled = false,
  emptySearch = false,
}: EditionLiveSponsorsQARosterProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(MouseSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const tierGroups = useMemo(() => groupSponsorsByTier(sponsors), [sponsors]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    const activeGroup = findTierGroupForLinkId(tierGroups, activeId);

    if (reorderDisabled || !onReorderTier || !over || activeId === overId || !activeGroup) {
      return;
    }

    const resolvedOverId = String(over.id);
    const overGroup = findTierGroupForLinkId(tierGroups, resolvedOverId);
    if (!overGroup || overGroup.tierRank !== activeGroup.tierRank) {
      return;
    }

    const sponsorIds = activeGroup.sponsors.map((sponsor) => sponsor.id);
    const nextOrder = reorderLinkIdsByDrag(sponsorIds, activeId, resolvedOverId);
    if (nextOrder === null) {
      return;
    }

    onReorderTier(activeGroup.tierRank, nextOrder);
  }

  if (sponsors.length === 0) {
    if (emptySearch) {
      return (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No sponsors match your search.
        </p>
      );
    }

    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        No live sponsors on this edition yet.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {tierGroups.map((group) => (
          <EditionLiveSponsorsTierSection
            key={tierContainerId(group)}
            containerId={tierContainerId(group)}
            group={group}
            onEdit={onEdit}
            onLogo={onLogo}
            onRemove={onRemove}
            onMove={onMove}
            reorderDisabled={reorderDisabled}
          />
        ))}
      </div>
    </DndContext>
  );
}
