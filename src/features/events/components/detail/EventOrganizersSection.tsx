import type { PublicOrganizerRow } from "@/src/features/events/server/mapPublicOrganizers";

import { EventOrganizerListItem } from "./EventOrganizerListItem";

type EventOrganizersSectionProps = {
  organizers: PublicOrganizerRow[];
};

export function EventOrganizersSection({ organizers }: EventOrganizersSectionProps) {
  if (organizers.length === 0) {
    return <EventOrganizersEmptyState />;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Organizers</h2>
      <ul className="space-y-2">
        {organizers.map((organizer) => (
          <EventOrganizerListItem key={organizer.id} organizer={organizer} />
        ))}
      </ul>
    </div>
  );
}

function EventOrganizersEmptyState() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Organizers</h2>
      <p className="mt-3 text-sm text-slate-600">
        No organizers are listed for this edition yet.
      </p>
    </div>
  );
}
