"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/src/components/common";
import type { CityOption } from "@/src/features/companies/server/getCityOptions";

type ApiResponse = {
  ok: boolean;
  error?: string;
};

type NewCompanyFormProps = {
  cities: CityOption[];
};

export default function NewCompanyForm({ cities }: NewCompanyFormProps) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [cityId, setCityId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        website,
        city_id: cityId.trim() === "" ? null : cityId,
      };
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;

      if (response.ok && data.ok) {
        setResult({ ok: true, message: "Company created successfully." });
        setName("");
        setWebsite("");
        setCityId("");
        return;
      }

      setResult({ ok: false, message: data.error ?? "Failed to create company." });
    } catch (submitError) {
      const message =
        submitError instanceof Error && submitError.message.trim() !== ""
          ? submitError.message.trim()
          : "Failed to create company";
      setResult({ ok: false, message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        New Company
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Manually create a company record.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Company name
          </span>
          <input
            id="new-company-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Acme Inc."
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Website
          </span>
          <input
            id="new-company-website"
            type="text"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="https://acme.com"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            City
          </span>
          <select
            id="new-company-city-id"
            value={cityId}
            onChange={(event) => setCityId(event.target.value)}
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">No city / Unknown</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            City is optional. Leave as &quot;No city / Unknown&quot; if not applicable.
          </p>
        </label>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating..." : "Create Company"}
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
