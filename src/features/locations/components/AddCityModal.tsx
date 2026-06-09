"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import type {
  CityOption,
  CountryOption,
  StateOption,
} from "@/src/features/locations/server/locationAdmin";
import { formInputClass } from "@/src/lib/design/classes";

type AddCityModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (city: CityOption) => void;
};

type CreateCityResponse = {
  ok: boolean;
  error?: string;
  city?: CityOption;
  existingCity?: CityOption;
};

export function AddCityModal({ open, onClose, onCreated }: AddCityModalProps) {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [cityName, setCityName] = useState("");
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setCityName("");
    setCountryId("");
    setStateId("");
    setStates([]);

    let cancelled = false;
    setIsLoadingCountries(true);
    void fetch("/api/admin/countries")
      .then(async (response) => {
        const data = (await response.json()) as {
          ok: boolean;
          countries?: CountryOption[];
        };
        if (!cancelled && data.ok && Array.isArray(data.countries)) {
          setCountries(data.countries);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load countries.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCountries(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || countryId === "") {
      setStates([]);
      setStateId("");
      return;
    }

    let cancelled = false;
    setIsLoadingStates(true);
    void fetch(`/api/admin/states?countryId=${encodeURIComponent(countryId)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          ok: boolean;
          states?: StateOption[];
        };
        if (!cancelled && data.ok && Array.isArray(data.states)) {
          setStates(data.states);
          setStateId("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load states.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, countryId]);

  if (!open) return null;

  const statesRequired = states.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: cityName,
          country_id: countryId,
          state_id: stateId !== "" ? stateId : null,
        }),
      });
      const data = (await response.json()) as CreateCityResponse;

      if (data.ok && data.city) {
        onCreated(data.city);
        onClose();
        return;
      }

      if (data.existingCity) {
        setError(
          `${data.error ?? "City already exists."} Use "${data.existingCity.label}" from the list.`,
        );
        return;
      }

      setError(data.error ?? "Failed to create city.");
    } catch {
      setError("Failed to create city.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-city-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div>
          <h2 id="add-city-title" className="text-lg font-semibold text-slate-900">
            Add city
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a city and return to your form with it selected.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Country</span>
          <select
            required
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            disabled={isSubmitting || isLoadingCountries}
            className={formInputClass}
          >
            <option value="">
              {isLoadingCountries ? "Loading countries…" : "Select a country"}
            </option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </label>

        {countryId !== "" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              State / province{statesRequired ? "" : " (optional)"}
            </span>
            <select
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              required={statesRequired}
              disabled={isSubmitting || isLoadingStates}
              className={formInputClass}
            >
              <option value="">
                {isLoadingStates
                  ? "Loading states…"
                  : statesRequired
                    ? "Select a state"
                    : "No state required"}
              </option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
            {!isLoadingStates && states.length === 0 && countryId !== "" ? (
              <p className="text-xs text-slate-500">
                This country has no states in the directory. City will be linked to the country
                only.
              </p>
            ) : null}
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">City name</span>
          <input
            type="text"
            required
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            disabled={isSubmitting}
            className={formInputClass}
            placeholder="e.g. Miami"
          />
        </label>

        {error ? <InlineErrorBanner message={error} variant="error" /> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !countryId || !cityName.trim()}>
            {isSubmitting ? "Creating…" : "Create city"}
          </Button>
        </div>
      </form>
    </div>
  );
}
