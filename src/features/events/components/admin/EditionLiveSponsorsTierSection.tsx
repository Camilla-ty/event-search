import type { LiveSponsorRow, LiveSponsorTierGroup, SponsorMoveDirection } from "./liveSponsorTypes";
import { tierSectionTitle } from "./liveSponsorQaUtils";
import { LiveSponsorQARow } from "./LiveSponsorQARow";

type EditionLiveSponsorsTierSectionProps = {
  group: LiveSponsorTierGroup;
  onEdit?: (row: LiveSponsorRow) => void;
  onRemove?: (row: LiveSponsorRow) => void;
  onMove?: (row: LiveSponsorRow, direction: SponsorMoveDirection) => void;
  moveDisabled?: boolean;
};

export function EditionLiveSponsorsTierSection({
  group,
  onEdit,
  onRemove,
  onMove,
  moveDisabled = false,
}: EditionLiveSponsorsTierSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
        {tierSectionTitle(group)}
      </header>
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
              moveDisabled={moveDisabled}
              onEdit={onEdit}
              onRemove={onRemove}
              onMove={onMove}
            />
          );
        })}
      </ul>
    </section>
  );
}
