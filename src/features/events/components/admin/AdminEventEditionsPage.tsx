"use client";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { InlineErrorBanner, LoadingStatus } from "@/src/components/common";
import { useAdminEditionsCollection } from "@/src/features/events/client/useAdminEditionsCollection";
import type { AdminEditionsCollectionResult } from "@/src/features/events/server/adminEditionsCollection";

import { AdminEventEditionsFilterChips } from "./AdminEventEditionsFilterChips";
import { AdminEventEditionsListTable } from "./AdminEventEditionsListTable";

type AdminEventEditionsPageProps = {
  initial: AdminEditionsCollectionResult;
};

export function AdminEventEditionsPage({ initial }: AdminEventEditionsPageProps) {
  const { editions, params, isLoading, error, setFilter } = useAdminEditionsCollection(initial);

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Event Editions" },
        ]}
      />
      <AdminPageHeader
        title="Event Editions"
        description="Each occurrence of an event series (event series + year + location). Multiple event editions per event series and year are allowed."
      />
      <EventsSubNav />

      <AdminEventEditionsFilterChips params={params} onFilterChange={setFilter} />

      {error !== null ? <InlineErrorBanner message={error} /> : null}
      {isLoading && editions.length > 0 ? (
        <LoadingStatus message="Updating results…" />
      ) : null}

      <AdminEventEditionsListTable
        editions={editions}
        loading={isLoading && editions.length > 0}
      />
    </section>
  );
}
