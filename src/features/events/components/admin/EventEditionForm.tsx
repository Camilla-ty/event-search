"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { SlugChangeModal } from "@/src/features/admin/components/SlugChangeModal";
import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import type { CityOption } from "@/src/features/companies/server/getCityOptions";
import { AdminCitySelect } from "@/src/features/locations/components/AdminCitySelect";
import type { SeriesOption } from "@/src/features/events/server/getSeriesOptions";
import { formInputClass } from "@/src/lib/design/classes";
import { EditionSiblingWarnings } from "@/src/features/events/components/admin/EditionSiblingWarnings";
import type { EditionSiblingSummary } from "@/src/features/events/server/eventEditionAdmin";
import { buildEditionSlug, slugify } from "@/src/lib/slugify";

type EditionFormValues = {
  series_id: string;
  year: string;
  name: string;
  slug: string;
  website_url: string;
  start_date: string;
  end_date: string;
  city_id: string;
};

type EventEditionFormProps = {
  mode: "create" | "edit";
  editionId?: string;
  initial: EditionFormValues;
  series: SeriesOption[];
  cities: CityOption[];
  readOnlySeriesName?: string;
  readOnlySeriesId?: string;
  readOnlyYear?: number;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  edition?: { id: string };
};

const CURRENT_YEAR = new Date().getFullYear();

function editionWarnings(values: EditionFormValues): string[] {
  const messages: string[] = [];
  if (!values.website_url.trim()) {
    messages.push("Website is strongly recommended for sponsor research.");
  }
  if (!values.start_date && !values.end_date) {
    messages.push("Dates help users find this event. Historical editions may omit dates.");
  }
  if (!values.city_id) {
    messages.push("City improves event discovery and filtering.");
  }
  return messages;
}

export function EventEditionForm({
  mode,
  editionId,
  initial,
  series,
  cities,
  readOnlySeriesName,
  readOnlySeriesId,
  readOnlyYear,
}: EventEditionFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<EditionFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [slugModalOpen, setSlugModalOpen] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<"import" | "detail" | null>(null);
  const [siblings, setSiblings] = useState<EditionSiblingSummary[]>([]);

  const yearNumber = Number(values.year);
  const selectedCity = cities.find((city) => city.id === values.city_id);
  const citySlugHint = selectedCity?.city ?? null;

  const autoSlug = useMemo(() => {
    if (!values.name.trim() || !Number.isInteger(yearNumber)) return "";
    return buildEditionSlug(values.name, yearNumber, citySlugHint);
  }, [values.name, yearNumber, citySlugHint]);

  useEffect(() => {
    const seriesId = values.series_id.trim();
    if (!seriesId || !Number.isInteger(yearNumber) || yearNumber < 1900) {
      setSiblings([]);
      return;
    }

    const params = new URLSearchParams({
      seriesId,
      year: String(yearNumber),
    });
    if (editionId) {
      params.set("excludeId", editionId);
    }

    let cancelled = false;
    void fetch(`/api/admin/event-editions/siblings?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          ok: boolean;
          siblings?: EditionSiblingSummary[];
        };
        if (!cancelled && data.ok && Array.isArray(data.siblings)) {
          setSiblings(data.siblings);
        }
      })
      .catch(() => {
        if (!cancelled) setSiblings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [values.series_id, yearNumber, editionId]);

  const effectiveSlug =
    slugTouched && values.slug.trim() !== "" ? values.slug : autoSlug;
  const slugChanged = mode === "edit" && effectiveSlug !== initial.slug;
  const warnings = editionWarnings(values);

  function updateField<K extends keyof EditionFormValues>(
    key: K,
    value: EditionFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    const payload = {
      name: values.name,
      slug: effectiveSlug,
      website_url: values.website_url.trim() || null,
      start_date: values.start_date.trim() || null,
      end_date: values.end_date.trim() || null,
      city_id: values.city_id.trim() || null,
    };
    if (mode === "create") {
      return { ...payload, series_id: values.series_id, year: yearNumber };
    }
    return payload;
  }

  async function submitEdition(redirect: "import" | "detail" | "stay") {
    const payload = buildPayload();
    const url =
      mode === "create"
        ? "/api/admin/event-editions"
        : `/api/admin/event-editions/${editionId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as ApiResponse;

    if (!data.ok) {
      setResult({ ok: false, message: data.error ?? "Request failed." });
      return;
    }

    const id = data.edition?.id ?? editionId;
    if (mode === "create" && id) {
      if (redirect === "import") {
        router.push(`/admin/sponsor-imports/new?editionId=${id}`);
        return;
      }
      router.push(`/admin/events/editions/${id}`);
      return;
    }

    setResult({ ok: true, message: "Edition updated successfully." });
    router.refresh();
  }

  async function handleSave(redirect: "import" | "detail" | "stay") {
    if (slugChanged && !slugModalOpen) {
      setPendingRedirect(redirect === "stay" ? null : redirect);
      setSlugModalOpen(true);
      return;
    }

    setResult(null);
    setIsSubmitting(true);
    try {
      await submitEdition(redirect);
    } catch {
      setResult({ ok: false, message: "Request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSave("detail");
  }

  return (
    <>
      <div className="space-y-4">
        <WarningBanner messages={warnings} />
        <EditionSiblingWarnings
          siblings={siblings}
          year={yearNumber}
          cityId={values.city_id}
          cityLabel={selectedCity?.label ?? ""}
        />

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Identity
          </h2>

          {mode === "edit" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Series</p>
                <p className="mt-1 text-sm text-slate-900">
                  {readOnlySeriesId && readOnlySeriesName ? (
                    <Link
                      href={`/admin/events/series/${readOnlySeriesId}`}
                      className="text-brand-primary hover:underline"
                    >
                      {readOnlySeriesName}
                    </Link>
                  ) : (
                    (readOnlySeriesName ?? "—")
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">Series cannot be changed.</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Year</p>
                <p className="mt-1 text-sm text-slate-900">{readOnlyYear ?? "—"}</p>
                <p className="mt-1 text-xs text-slate-500">Year cannot be changed.</p>
              </div>
            </div>
          ) : (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Event series</span>
              <select
                value={values.series_id}
                onChange={(e) => updateField("series_id", e.target.value)}
                required
                disabled={isSubmitting || series.length === 0}
                className={formInputClass}
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
                <p className="text-xs text-slate-500">
                  <Link href="/admin/events/series/new" className="text-brand-primary underline">
                    Create an event series first
                  </Link>
                </p>
              ) : null}
            </label>
          )}

          {mode === "create" ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Year</span>
              <input
                type="number"
                required
                min={1900}
                max={2999}
                value={values.year}
                onChange={(e) => updateField("year", e.target.value)}
                disabled={isSubmitting}
                className={formInputClass}
              />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Edition name</span>
            <input
              type="text"
              required
              value={values.name}
              onChange={(e) => updateField("name", e.target.value)}
              disabled={isSubmitting}
              className={formInputClass}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Slug</span>
            <input
              type="text"
              required
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                updateField("slug", slugify(e.target.value));
              }}
              disabled={isSubmitting}
              className={formInputClass}
            />
            <p className="text-xs text-slate-500">Public path: /events/{effectiveSlug || "…"}</p>
          </label>

          <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Event details (recommended)
          </h2>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Website URL</span>
            <input
              type="text"
              value={values.website_url}
              onChange={(e) => updateField("website_url", e.target.value)}
              disabled={isSubmitting}
              className={formInputClass}
              placeholder="https://…"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Start date</span>
              <input
                type="date"
                value={values.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
                disabled={isSubmitting}
                className={formInputClass}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">End date</span>
              <input
                type="date"
                value={values.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
                disabled={isSubmitting}
                className={formInputClass}
              />
            </label>
          </div>

          <AdminCitySelect
            value={values.city_id}
            onChange={(cityId) => updateField("city_id", cityId)}
            initialCities={cities}
            disabled={isSubmitting}
          />

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            {mode === "create" ? (
              <>
                <Button
                  type="button"
                  disabled={isSubmitting || !values.series_id}
                  onClick={() => void handleSave("import")}
                >
                  {isSubmitting ? "Saving…" : "Create & import sponsors"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting || !values.series_id}
                  onClick={() => void handleSave("detail")}
                >
                  Create edition only
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save profile"}
              </Button>
            )}
          </div>
        </form>

        {result ? (
          <InlineErrorBanner
            message={result.message}
            variant={result.ok ? "success" : "error"}
          />
        ) : null}
      </div>

      <SlugChangeModal
        entityLabel="Edition"
        oldSlug={initial.slug}
        newSlug={effectiveSlug}
        publicPathPrefix="/events/"
        open={slugModalOpen}
        onCancel={() => {
          setSlugModalOpen(false);
          setPendingRedirect(null);
        }}
        onConfirm={() => {
          setSlugModalOpen(false);
          setIsSubmitting(true);
          void submitEdition(pendingRedirect ?? "stay").finally(() => {
            setIsSubmitting(false);
            setPendingRedirect(null);
          });
        }}
      />
    </>
  );
}

export { CURRENT_YEAR };
