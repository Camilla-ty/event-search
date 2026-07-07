import { publicTierSectionTitle } from "@/src/features/events/lib/groupSponsorsByTier";
import type { SponsorTierGroup } from "@/src/features/events/lib/groupSponsorsByTier";

import { PublicSponsorRosterRow } from "./PublicSponsorRosterRow";
import type { EventSponsorRow } from "./types";

type PublicSponsorTierSectionProps = {
  group: SponsorTierGroup<EventSponsorRow>;
};

export function PublicSponsorTierSection({ group }: PublicSponsorTierSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
        {publicTierSectionTitle(group)}
      </header>
      <ul>
        {group.sponsors.map((sponsor) => (
          <PublicSponsorRosterRow key={String(sponsor.id)} sponsor={sponsor} />
        ))}
      </ul>
    </section>
  );
}
