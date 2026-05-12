"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/src/components/common";
import type { CityOption } from "@/src/features/companies/server/getCityOptions";
import type { SeriesOption } from "@/src/features/events/server/getSeriesOptions";

type ApiResponse = {
  ok: boolean;
  error?: string;
};

type NewEventEditionFormProps = {
  cities: CityOption[];
  series: SeriesOption[];
};

function slugifyClient(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CURRENT_YEAR = new Date().getFullYear();

export default function NewEventEditionForm({
  cities,
  series,
}: NewEventEditionFormProps) {
  const [seriesId, setSeriesId] = useState("");
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [cityId, setCityId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const previewSlug = useMemo(() => {
    if (!name.trim() || !year.trim()) return "";
    return slugifyClient(`${name} ${year}`);
  }, [name, year]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setIsSubmitting(true);

    try {
      const yearNumber = Number(year);
      const payload = {
        series_id: seriesId,
        year: Number.isInteger(yearNumber) ? yearNumber : year,
        name,
        start_date: startDate,
        end_date: endDate,
        website_url: websiteUrl,
        city_id: cityId,
      };

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;

      if (response.ok && data.ok) {
        setResult({ ok: true, message: "Event edition created successfully." });
        setSeriesId("");
        setYear(String(CURRENT_YEAR));
        setName("");
        setStartDate("");
        setEndDate("");
        setWebsiteUrl("");
        setCityId("");
        return;
      }

      setResult({
        ok: false,
        message: data.error ?? "Failed to create event edition.",
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error && submitError.message.trim() !== ""
          ? submitError.message.trim()
          : "Failed to create event edition.";
      setResult({ ok: false, message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        New Event Edition
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Manually create an event edition record.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Series
          </span>
          <select
            value={seriesId}
            onChange={(event) => setSeriesId(event.target.value)}
            required
            disabled={isSubmitting || series.length === 0}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">
              {series.length === 0 ? "No series available" : "Select a series"}
            </option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {series.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No event series found. Create series records first.
            </p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Year
          </span>
          <input
            type="number"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            required
            disabled={isSubmitting}
            min={1900}
            max={2999}
            step={1}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder={String(CURRENT_YEAR)}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Token2049 Singapore"
          />
        </label>

        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
          Slug preview:{" "}
          <span className="font-mono">
            {previewSlug || "(enter name and year)"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Start date
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              End date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Website URL
          </span>
          <input
            type="text"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="https://www.asia.token2049.com/"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            City
          </span>
          <select
            value={cityId}
            onChange={(event) => setCityId(event.target.value)}
            required
            disabled={isSubmitting || cities.length === 0}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">
              {cities.length === 0 ? "No cities available" : "Select a city"}
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
          {cities.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No cities found. Add city records first.
            </p>
          ) : null}
        </label>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating..." : "Create Event Edition"}
        </Button>
      </form>

      {result ? (
        <div
          className={[
            "mt-4 rounded-lg border px-4 py-3 text-sm font-medium",
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100",
          ].join(" ")}
        >
          {result.message}
        </div>
      ) : null}
    </div>
  );
}
