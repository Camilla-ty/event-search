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

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function EventExhibitorsSection({
  exhibitors,
  embedded = false,
}: EventExhibitorsSectionProps) {
  const groups = groupPublicExhibitorsByTier(exhibitors);

  return (
    <EditionSectionSurface embedded={embedded}>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Exhibitors</h2>
      <div className="space-y-4">
        {groups.map((group) => {
          const count = group.exhibitors.length;
          const heading = formatPublicExhibitorTierHeading(group);
          return (
            <section
              key={group.tierRank === null ? "null" : String(group.tierRank)}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <header className="flex min-h-12 items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-sm font-semibold tracking-tight text-slate-800">
                <span>
                  {heading} · {count} {pluralize(count, "exhibitor", "exhibitors")}
                </span>
              </header>
              <ul className="border-t border-slate-200">
                {group.exhibitors.map((exhibitor) => (
                  <PublicExhibitorRosterRow key={exhibitor.id} exhibitor={exhibitor} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </EditionSectionSurface>
  );
}
