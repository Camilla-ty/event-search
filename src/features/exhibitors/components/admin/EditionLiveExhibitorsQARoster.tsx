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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo } from "react";

import { groupExhibitorsByTier } from "@/src/features/exhibitors/lib/groupExhibitorsByTier";
import { resolveExhibitorDragReorder } from "@/src/features/exhibitors/lib/liveExhibitorReorderClient";
import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import type { ExhibitorMoveDirection } from "@/src/lib/validation/eventExhibitor";

import { EditionLiveExhibitorsTierSection } from "./EditionLiveExhibitorsTierSection";

type EditionLiveExhibitorsQARosterProps = {
  exhibitors: LiveExhibitorRow[];
  onEdit?: (row: LiveExhibitorRow) => void;
  onRemove?: (row: LiveExhibitorRow) => void;
  onMove?: (row: LiveExhibitorRow, direction: ExhibitorMoveDirection) => void;
  onReorderTier?: (tierRank: number | null, orderedLinkIds: readonly string[]) => void;
  reorderDisabled?: boolean;
};

function tierContainerId(tierRank: number | null): string {
  return tierRank === null ? "tier-unranked" : `tier-${tierRank}`;
}

export function EditionLiveExhibitorsQARoster({
  exhibitors,
  onEdit,
  onRemove,
  onMove,
  onReorderTier,
  reorderDisabled = false,
}: EditionLiveExhibitorsQARosterProps) {
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

  const tierGroups = useMemo(() => groupExhibitorsByTier(exhibitors), [exhibitors]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!onReorderTier) {
      return;
    }

    const resolved = resolveExhibitorDragReorder({
      exhibitors,
      activeLinkId: String(active.id),
      overLinkId: over ? String(over.id) : null,
      reorderDisabled,
    });
    if (resolved === null) {
      return;
    }

    onReorderTier(resolved.tierRank, resolved.orderedLinkIds);
  }

  if (exhibitors.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {tierGroups.map((group) => (
          <EditionLiveExhibitorsTierSection
            key={tierContainerId(group.tierRank)}
            containerId={tierContainerId(group.tierRank)}
            group={group}
            onEdit={onEdit}
            onRemove={onRemove}
            onMove={onMove}
            reorderDisabled={reorderDisabled}
          />
        ))}
      </div>
    </DndContext>
  );
}
