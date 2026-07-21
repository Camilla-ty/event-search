import { publicTierSectionTitle } from "@/src/features/events/lib/groupSponsorsByTier";
import type { SponsorTierGroup } from "@/src/features/events/lib/groupSponsorsByTier";

import { PublicSponsorRosterRow } from "./PublicSponsorRosterRow";
import type { EventSponsorRow } from "./types";

type PublicSponsorTierSectionProps = {
  group: SponsorTierGroup<EventSponsorRow>;
  totalCount?: number;
};

export function PublicSponsorTierSection({
  group,
  totalCount,
}: PublicSponsorTierSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold tracking-tight text-slate-800">
        {publicTierSectionTitle(group, totalCount)}
      </header>
      <ul>
        {group.sponsors.map((sponsor) => (
          <PublicSponsorRosterRow key={String(sponsor.id)} sponsor={sponsor} />
        ))}
      </ul>
    </section>
  );
}
