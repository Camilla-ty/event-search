import { EventSponsorListItem } from "./EventSponsorListItem";
import { formatSponsorGroupCount, publicTierGroupLabel } from "./eventSponsorGrouping";
import type { EventSponsorTierGroup } from "./eventSponsorGrouping";

type SponsorGroupCardProps = {
  group: EventSponsorTierGroup;
};

export function SponsorGroupCard({ group }: SponsorGroupCardProps) {
  const heading = publicTierGroupLabel(group.tierRank, group.tierLabel);
  const countLabel = formatSponsorGroupCount(group.sponsors.length);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-base font-semibold text-slate-900">{heading}</h3>
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          {countLabel}
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
        {group.sponsors.map((sponsor) => (
          <EventSponsorListItem key={String(sponsor.id)} sponsor={sponsor} variant="grouped" />
        ))}
      </ul>
    </section>
  );
}
