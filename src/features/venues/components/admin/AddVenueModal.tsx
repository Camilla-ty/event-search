"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";
import { slugify } from "@/src/lib/slugify";

type VenueOption = {
  id: string;
  name: string;
  label: string;
};

type AddVenueModalProps = {
  open: boolean;
  cityId: string;
  cityLabel?: string;
  onClose: () => void;
  onCreated: (venue: VenueOption) => void;
};

type CreateVenueResponse = {
  ok: boolean;
  error?: string;
  venue?: { id: string; name: string };
  warnings?: string[];
};

export function AddVenueModal({
  open,
  cityId,
  cityLabel,
  onClose,
  onCreated,
}: AddVenueModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Venue name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: slugify(trimmedName),
          city_id: cityId,
        }),
      });
      const data = (await response.json()) as CreateVenueResponse;

      if (!response.ok || !data.ok || !data.venue) {
        setError(data.error ?? "Failed to create venue.");
        return;
      }

      const venue: VenueOption = {
        id: data.venue.id,
        name: data.venue.name,
        label: data.venue.name,
      };
      setName("");
      onCreated(venue);
      onClose();
    } catch {
      setError("Failed to create venue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-venue-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="add-venue-title" className="text-lg font-semibold text-slate-900">
          Add venue
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Creates a venue in {cityLabel?.trim() || "the selected city"}. You can add more details
          on the venue admin page later.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Venue name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              className={formInputClass}
              autoFocus
            />
          </label>

          {error ? <InlineErrorBanner message={error} variant="error" /> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create venue"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
