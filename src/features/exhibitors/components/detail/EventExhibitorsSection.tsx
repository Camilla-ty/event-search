import { EditionSectionSurface } from "@/src/features/events/components/detail/EditionSectionSurface";
import { PublicExhibitorRosterRow } from "@/src/features/exhibitors/components/detail/PublicExhibitorRosterRow";
import {
  formatPublicExhibitorTierHeading,
  groupPublicExhibitorsByTier,
  type PublicExhibitorRow,
} from "@/src/features/exhibitors/server/exhibitorsPublic";

type EventExhibitorsSectionProps = {
  exhibitors: PublicExhibitorRow[];
  embedded?: boolean;
};

export function EventExhibitorsSection({
  exhibitors,
  embedded = false,
}: EventExhibitorsSectionProps) {
  const groups = groupPublicExhibitorsByTier(exhibitors);

  return (
    <EditionSectionSurface embedded={embedded}>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Exhibitors</h2>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.tierRank === null ? "null" : String(group.tierRank)}>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              {formatPublicExhibitorTierHeading(group)}
            </h3>
            <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {group.exhibitors.map((exhibitor) => (
                <PublicExhibitorRosterRow key={exhibitor.id} exhibitor={exhibitor} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </EditionSectionSurface>
  );
}
