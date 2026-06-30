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
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {countLabel}
        </span>
      </header>

      <ul className="divide-y divide-slate-100">
        {group.sponsors.map((sponsor) => (
          <EventSponsorListItem key={String(sponsor.id)} sponsor={sponsor} variant="grouped" />
        ))}
      </ul>
    </section>
  );
}
