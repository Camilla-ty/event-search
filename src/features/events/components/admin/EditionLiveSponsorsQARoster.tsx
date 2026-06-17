import type { LiveSponsorRow, SponsorMoveDirection } from "./liveSponsorTypes";
import { groupSponsorsByTier } from "./liveSponsorQaUtils";
import { EditionLiveSponsorsTierSection } from "./EditionLiveSponsorsTierSection";

type EditionLiveSponsorsQARosterProps = {
  sponsors: LiveSponsorRow[];
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  moveDisabled?: boolean;
  emptySearch?: boolean;
};

export function EditionLiveSponsorsQARoster({
  sponsors,
  onEdit,
  onRemove,
  onMove,
  moveDisabled = false,
  emptySearch = false,
}: EditionLiveSponsorsQARosterProps) {
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

  const tierGroups = groupSponsorsByTier(sponsors);

  return (
    <div className="space-y-4">
      {tierGroups.map((group) => (
        <EditionLiveSponsorsTierSection
          key={group.tierRank === null ? "unranked" : String(group.tierRank)}
          group={group}
          onEdit={onEdit}
          onRemove={onRemove}
          onMove={onMove}
          moveDisabled={moveDisabled}
        />
      ))}
    </div>
  );
}
