import { notFound } from "next/navigation";

import { Badge } from "@/src/components/common";
import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { VenueForm } from "@/src/features/venues/components/admin/VenueForm";
import { VenueLifecycleSection } from "@/src/features/venues/components/admin/VenueLifecycleSection";
import { VenueLinkedEditionsTable } from "@/src/features/venues/components/admin/VenueLinkedEditionsTable";
import {
  getVenueAdminById,
  listLinkedEditionsForVenueAdmin,
} from "@/src/features/venues/server/venueAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
};

export default async function AdminVenueDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const initialNotice = query.warning?.trim() || null;
  const venue = await getVenueAdminById(id);
  if (!venue) notFound();

  const [cities, linkedEditions] = await Promise.all([
    getCityOptions(),
    listLinkedEditionsForVenueAdmin(id),
  ]);

  const isArchived = venue.archived_at !== null;

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Venues", href: "/admin/venues" },
          { label: venue.name },
        ]}
      />
      <AdminPageHeader
        title={venue.name}
        description="Edit venue profile, view linked events, and manage lifecycle."
        actions={
          isArchived ? (
            <Badge variant="neutral">Archived</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )
        }
      />

      <VenueForm
        mode="edit"
        venueId={venue.id}
        cities={cities}
        linkedEditionCount={venue.linked_edition_count}
        cityLabel={venue.city_label}
        initialNotice={initialNotice}
        initial={{
          name: venue.name,
          slug: venue.slug,
          city_id: venue.city_id,
          website_url: venue.website_url ?? "",
          address_text: venue.address_text ?? "",
          logo_url: venue.logo_url ?? "",
        }}
      />

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Linked events</h2>
        <VenueLinkedEditionsTable editions={linkedEditions} />
      </div>

      <VenueLifecycleSection
        venueId={venue.id}
        venueName={venue.name}
        isArchived={isArchived}
      />
    </section>
  );
}
