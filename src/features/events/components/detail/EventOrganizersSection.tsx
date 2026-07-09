import type { PublicOrganizerRow } from "@/src/features/events/server/mapPublicOrganizers";

import { EditionSectionSurface } from "./EditionSectionSurface";
import { EventOrganizerListItem } from "./EventOrganizerListItem";

type EventOrganizersSectionProps = {
  organizers: PublicOrganizerRow[];
  embedded?: boolean;
};

export function EventOrganizersSection({
  organizers,
  embedded = false,
}: EventOrganizersSectionProps) {
  if (organizers.length === 0) {
    return <EventOrganizersEmptyState embedded={embedded} />;
  }

  return (
    <EditionSectionSurface embedded={embedded}>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Organizers</h2>
      <ul className="space-y-2">
        {organizers.map((organizer) => (
          <EventOrganizerListItem key={organizer.id} organizer={organizer} />
        ))}
      </ul>
    </EditionSectionSurface>
  );
}

function EventOrganizersEmptyState({ embedded = false }: { embedded?: boolean }) {
  return (
    <EditionSectionSurface embedded={embedded}>
      <h2 className="text-lg font-semibold text-slate-900">Organizers</h2>
      <p className="mt-3 text-sm text-slate-600">
        No organizers are listed for this edition yet.
      </p>
    </EditionSectionSurface>
  );
}
