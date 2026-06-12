"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { SlugChangeModal } from "@/src/features/admin/components/SlugChangeModal";
import type { KeywordRow } from "@/src/features/events/types/keywords";
import { formInputClass } from "@/src/lib/design/classes";
import { slugify } from "@/src/lib/slugify";

import { SeriesKeywordMultiSelect } from "./SeriesKeywordMultiSelect";

type SeriesFormValues = {
  name: string;
  slug: string;
  description: string;
  website_url: string;
  logo_url: string;
};

type EventSeriesFormProps = {
  mode: "create" | "edit";
  seriesId?: string;
  initial: SeriesFormValues;
  allKeywords: KeywordRow[];
  initialKeywordIds: string[];
};

type ApiResponse = { ok: boolean; error?: string; series?: { id: string } };

export function EventSeriesForm({
  mode,
  seriesId,
  initial,
  allKeywords,
  initialKeywordIds,
}: EventSeriesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<SeriesFormValues>(initial);
  const [keywordIds, setKeywordIds] = useState<string[]>(initialKeywordIds);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [slugModalOpen, setSlugModalOpen] = useState(false);

  const autoSlug = useMemo(() => slugify(values.name), [values.name]);
  const effectiveSlug = slugTouched ? values.slug : autoSlug;
  const slugChanged = mode === "edit" && effectiveSlug !== initial.slug;

  function updateField<K extends keyof SeriesFormValues>(key: K, value: SeriesFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submitPayload() {
    const base = {
      name: values.name,
      slug: effectiveSlug,
      description: values.description.trim() || null,
      website_url: values.website_url.trim() || null,
      keyword_ids: keywordIds,
    };

    const payload =
      mode === "edit"
        ? { ...base, logo_url: values.logo_url.trim() || null }
        : base;

    const url =
      mode === "create"
        ? "/api/admin/event-series"
        : `/api/admin/event-series/${seriesId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await response.json()) as ApiResponse;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (slugChanged && !slugModalOpen) {
      setSlugModalOpen(true);
      return;
    }

    setResult(null);
    setIsSubmitting(true);
    try {
      const data = await submitPayload();
      if (data.ok && data.series) {
        router.push(`/admin/events/series/${data.series.id}`);
        router.refresh();
        return;
      }
      if (data.ok && mode === "edit" && seriesId) {
        setSlugModalOpen(false);
        setResult({ ok: true, message: "Series updated successfully." });
        router.refresh();
        return;
      }
      setResult({ ok: false, message: data.error ?? "Request failed." });
    } catch {
      setResult({ ok: false, message: "Request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmSlugAndSave() {
    setSlugModalOpen(false);
    setIsSubmitting(true);
    setResult(null);
    try {
      const data = await submitPayload();
      if (data.ok) {
        if (mode === "create" && data.series) {
          router.push(`/admin/events/series/${data.series.id}`);
        } else {
          setResult({ ok: true, message: "Series updated successfully." });
          router.refresh();
        }
        return;
      }
      setResult({ ok: false, message: data.error ?? "Request failed." });
    } catch {
      setResult({ ok: false, message: "Request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Name</span>
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
              updateField("slug", e.target.value);
            }}
            disabled={isSubmitting}
            className={formInputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <textarea
            value={values.description}
            onChange={(e) => updateField("description", e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className={formInputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Website URL</span>
          <input
            type="text"
            value={values.website_url}
            onChange={(e) => updateField("website_url", e.target.value)}
            disabled={isSubmitting}
            className={formInputClass}
            placeholder="https://example.com"
          />
          {mode === "create" ? (
            <p className="text-xs text-slate-500">
              Logo is fetched automatically from this website after save.
            </p>
          ) : null}
        </label>

        {mode === "edit" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Logo URL</span>
            <input
              type="text"
              value={values.logo_url}
              onChange={(e) => updateField("logo_url", e.target.value)}
              disabled={isSubmitting}
              className={formInputClass}
            />
            <p className="text-xs text-slate-500">
              Review the auto-fetched logo. Paste a different URL to override, or clear this field
              and save to fetch again from the website URL.
            </p>
          </label>
        ) : null}

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Keywords</span>
          <SeriesKeywordMultiSelect
            keywords={allKeywords}
            selectedIds={keywordIds}
            onChange={setKeywordIds}
            disabled={isSubmitting}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : mode === "create" ? "Create series" : "Save changes"}
        </Button>
      </form>

      {result ? (
        <InlineErrorBanner
          className="mt-4"
          message={result.message}
          variant={result.ok ? "success" : "error"}
        />
      ) : null}

      <SlugChangeModal
        entityLabel="Series"
        oldSlug={initial.slug}
        newSlug={effectiveSlug}
        publicPathPrefix="/events/series/"
        open={slugModalOpen}
        onCancel={() => setSlugModalOpen(false)}
        onConfirm={confirmSlugAndSave}
      />
    </>
  );
}
