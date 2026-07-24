"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { VenueOption } from "@/src/features/venues/server/getVenueOptions";
import { formInputClass } from "@/src/lib/design/classes";

import { AddVenueModal } from "./AddVenueModal";

type LinkedVenue = {
  id: string;
  name: string;
  archived: boolean;
};

type AdminVenueSelectProps = {
  value: string;
  onChange: (venueId: string) => void;
  cityId: string;
  cityLabel?: string;
  linkedVenue?: LinkedVenue | null;
  disabled?: boolean;
  onVenueCreated?: (venue: VenueOption) => void;
};

export function AdminVenueSelect({
  value,
  onChange,
  cityId,
  cityLabel,
  linkedVenue,
  disabled = false,
  onVenueCreated,
}: AdminVenueSelectProps) {
  const [options, setOptions] = useState<VenueOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [inlineVenues, setInlineVenues] = useState<VenueOption[]>([]);

  const cityReady = cityId.trim() !== "";

  useEffect(() => {
    if (!cityReady) {
      setOptions([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void fetch(`/api/admin/venues/options?cityId=${encodeURIComponent(cityId)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          ok: boolean;
          venues?: VenueOption[];
          error?: string;
        };
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.venues)) {
          setOptions([]);
          setLoadError(data.error ?? "Failed to load venues.");
          return;
        }
        setOptions(data.venues);
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setLoadError("Failed to load venues.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId, cityReady]);

  const mergedOptions = useMemo(() => {
    const byId = new Map<string, VenueOption>();
    for (const venue of options) {
      byId.set(venue.id, venue);
    }
    for (const venue of inlineVenues) {
      byId.set(venue.id, venue);
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [inlineVenues, options]);

  const showArchivedLinkedVenue =
    linkedVenue &&
    linkedVenue.id === value &&
    linkedVenue.archived &&
    !mergedOptions.some((venue) => venue.id === linkedVenue.id);

  function handleVenueCreated(venue: VenueOption) {
    setInlineVenues((prev) => {
      if (prev.some((row) => row.id === venue.id)) return prev;
      return [...prev, venue];
    });
    onVenueCreated?.(venue);
    onChange(venue.id);
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">Venue</span>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            disabled={disabled || !cityReady}
            className="text-sm text-brand-primary hover:underline disabled:opacity-50"
          >
            Add venue
          </button>
        </div>

        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || !cityReady || isLoading}
          className={formInputClass}
        >
          <option value="">
            {!cityReady
              ? "Select a city first"
              : isLoading
                ? "Loading venues…"
                : "No venue"}
          </option>
          {showArchivedLinkedVenue ? (
            <option value={linkedVenue.id}>{linkedVenue.name} (archived)</option>
          ) : null}
          {mergedOptions.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.label}
            </option>
          ))}
        </select>

        {!cityReady ? (
          <p className="text-xs text-slate-500">Select a city before choosing a venue.</p>
        ) : null}
        {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
        {showArchivedLinkedVenue ? (
          <p className="text-xs text-slate-500">
            This event is linked to an archived venue. You can keep it, clear it, or choose an
            active venue in the same city.{" "}
            <Link href={`/admin/venues/${linkedVenue.id}`} className="text-brand-primary underline">
              View venue
            </Link>
          </p>
        ) : null}
      </div>

      <AddVenueModal
        open={addModalOpen}
        cityId={cityId}
        cityLabel={cityLabel}
        onClose={() => setAddModalOpen(false)}
        onCreated={handleVenueCreated}
      />
    </>
  );
}
