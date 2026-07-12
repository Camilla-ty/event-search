"use client";

import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { InlineErrorBanner, LoadingStatus } from "@/src/components/common";
import { useAdminEditionsCollection } from "@/src/features/events/client/useAdminEditionsCollection";
import type { AdminEditionsCollectionResult } from "@/src/features/events/server/adminEditionsCollection";
import { primaryCtaClass } from "@/src/lib/design/classes";

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
          { label: "Editions" },
        ]}
      />
      <AdminPageHeader
        title="Event editions"
        description="Each occurrence of an event (series + year + location). Multiple editions per series and year are allowed."
        actions={
          <Link href="/admin/events/editions/new" className={`${primaryCtaClass} h-10`}>
            Create edition
          </Link>
        }
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
