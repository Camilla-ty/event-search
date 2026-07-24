"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { SlugChangeModal } from "@/src/features/admin/components/SlugChangeModal";
import type { KeywordRow } from "@/src/features/events/types/keywords";
import { formInputClass } from "@/src/lib/design/classes";
import { EVENT_LIFECYCLE_STATUS_OPTIONS } from "@/src/lib/validation/eventLifecycleStatus";
import { slugify } from "@/src/lib/slugify";

import {
  MergedIntoSeriesPicker,
  type MergedIntoSeriesOption,
} from "./MergedIntoSeriesPicker";
import { EventSeriesLogoPreview } from "./EventSeriesLogoPreview";
import { SeriesKeywordMultiSelect } from "./SeriesKeywordMultiSelect";

const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

type SeriesFormValues = {
  name: string;
  slug: string;
  website_url: string;
  logo_url: string;
  lifecycle_status: string;
  merged_into_series_id: string;
};

type EventSeriesFormProps = {
  mode: "create" | "edit";
  seriesId?: string;
  initial: SeriesFormValues;
  allKeywords: KeywordRow[];
  initialKeywordIds: string[];
  initialMergedIntoSeries?: MergedIntoSeriesOption | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  warnings?: string[];
  series?: { id: string; logo_url?: string | null };
};

type UploadLogoResponse = {
  ok: boolean;
  error?: string;
  series?: { logo_url?: string | null };
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateLogoUploadFile(file: File): string | null {
  if (file.size === 0) {
    return "Logo file is empty.";
  }

  if (file.size > MAX_LOGO_UPLOAD_BYTES) {
    return "Logo must be 2 MB or smaller.";
  }

  const mimeType = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    !ALLOWED_LOGO_UPLOAD_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_LOGO_UPLOAD_MIME_TYPES)[number],
    )
  ) {
    return "Please upload a PNG, JPG, or WebP image.";
  }

  return null;
}

export function EventSeriesForm({
  mode,
  seriesId,
  initial,
  allKeywords,
  initialKeywordIds,
  initialMergedIntoSeries = null,
}: EventSeriesFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<SeriesFormValues>(initial);
  const [mergedIntoSelection, setMergedIntoSelection] =
    useState<MergedIntoSeriesOption | null>(initialMergedIntoSeries);
  const [keywordIds, setKeywordIds] = useState<string[]>(initialKeywordIds);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    variant?: "success" | "warning" | "error";
  } | null>(null);
  const [slugModalOpen, setSlugModalOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoFileInputKey, setLogoFileInputKey] = useState(0);
  const [logoPreviewCacheKey, setLogoPreviewCacheKey] = useState<string | null>(null);
  const [logoUploadResult, setLogoUploadResult] = useState<{
    ok: boolean;
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const autoSlug = useMemo(() => slugify(values.name), [values.name]);
  const effectiveSlug = slugTouched ? values.slug : autoSlug;
  const slugChanged = mode === "edit" && effectiveSlug !== initial.slug;
  const fieldsDisabled = isSubmitting || isUploadingLogo;
  const logoUploadDisabled = selectedLogoFile === null || fieldsDisabled;

  function updateField<K extends keyof SeriesFormValues>(key: K, value: SeriesFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submitPayload() {
    const lifecycleStatus = values.lifecycle_status.trim() || null;
    const mergedIntoSeriesId =
      lifecycleStatus === "merged" ? values.merged_into_series_id.trim() || null : null;

    const base = {
      name: values.name,
      slug: effectiveSlug,
      website_url: values.website_url.trim() || null,
      lifecycle_status: lifecycleStatus,
      merged_into_series_id: mergedIntoSeriesId,
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

  function applySubmitResponse(data: ApiResponse) {
    if (data.ok && data.series && mode === "create") {
      router.push(`/admin/events/series/${data.series.id}`);
      router.refresh();
      return;
    }

    if (data.ok && mode === "edit" && seriesId) {
      if (data.series?.logo_url !== undefined) {
        setValues((prev) => ({
          ...prev,
          logo_url: data.series?.logo_url ?? "",
        }));
      }
      setSlugModalOpen(false);
      const warning = data.warnings?.[0];
      setResult({
        ok: true,
        message: warning ?? "Event brand updated successfully.",
        variant: warning ? "warning" : "success",
      });
      router.refresh();
      return;
    }

    setResult({
      ok: false,
      message: data.error ?? "Request failed.",
      variant: "error",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values.lifecycle_status === "merged" && values.merged_into_series_id.trim() === "") {
      setResult({
        ok: false,
        message: "Select a destination event brand when lifecycle status is Merged.",
        variant: "error",
      });
      return;
    }

    if (slugChanged && !slugModalOpen) {
      setSlugModalOpen(true);
      return;
    }

    setResult(null);
    setIsSubmitting(true);
    try {
      const data = await submitPayload();
      if (data.ok) {
        applySubmitResponse(data);
        return;
      }
      setResult({
        ok: false,
        message: data.error ?? "Request failed.",
        variant: "error",
      });
    } catch {
      setResult({ ok: false, message: "Request failed.", variant: "error" });
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
        applySubmitResponse(data);
        return;
      }
      setResult({
        ok: false,
        message: data.error ?? "Request failed.",
        variant: "error",
      });
    } catch {
      setResult({ ok: false, message: "Request failed.", variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogoUpload() {
    if (!seriesId || !selectedLogoFile) {
      return;
    }

    const validationError = validateLogoUploadFile(selectedLogoFile);
    if (validationError) {
      setLogoUploadResult({
        ok: false,
        message: validationError,
        variant: "error",
      });
      return;
    }

    setLogoUploadResult(null);
    setIsUploadingLogo(true);

    try {
      const form = new FormData();
      form.append("file", selectedLogoFile);

      const response = await fetch(`/api/admin/event-series/${seriesId}/logo`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as UploadLogoResponse;

      if (!response.ok || !data.ok || !data.series) {
        setLogoUploadResult({
          ok: false,
          message: data.error ?? "Logo upload failed.",
          variant: "error",
        });
        return;
      }

      const nextLogoUrl = data.series.logo_url ?? "";
      const cacheKey = new Date().toISOString();
      setValues((prev) => ({ ...prev, logo_url: nextLogoUrl }));
      setLogoPreviewCacheKey(cacheKey);
      setSelectedLogoFile(null);
      setLogoFileInputKey((current) => current + 1);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
      setLogoUploadResult({
        ok: true,
        message: "Logo uploaded.",
        variant: "success",
      });
      router.refresh();
    } catch {
      setLogoUploadResult({
        ok: false,
        message: "Logo upload failed.",
        variant: "error",
      });
    } finally {
      setIsUploadingLogo(false);
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
            disabled={fieldsDisabled}
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
            disabled={fieldsDisabled}
            className={formInputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Website URL</span>
          <input
            type="text"
            value={values.website_url}
            onChange={(e) => updateField("website_url", e.target.value)}
            disabled={fieldsDisabled}
            className={formInputClass}
            placeholder="https://example.com"
          />
        </label>

        <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Event history
        </h2>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Lifecycle status</span>
          <select
            value={values.lifecycle_status}
            onChange={(e) => {
              const nextStatus = e.target.value;
              setValues((prev) => ({
                ...prev,
                lifecycle_status: nextStatus,
                merged_into_series_id:
                  nextStatus === "merged" ? prev.merged_into_series_id : "",
              }));
              if (nextStatus !== "merged") {
                setMergedIntoSelection(null);
              }
            }}
            disabled={fieldsDisabled}
            className={formInputClass}
          >
            {EVENT_LIFECYCLE_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {values.lifecycle_status === "merged" ? (
          <MergedIntoSeriesPicker
            selected={mergedIntoSelection}
            excludeSeriesId={seriesId}
            disabled={fieldsDisabled}
            onSelect={(series) => {
              setMergedIntoSelection(series);
              updateField("merged_into_series_id", series.id);
            }}
            onClear={() => {
              setMergedIntoSelection(null);
              updateField("merged_into_series_id", "");
            }}
          />
        ) : null}

        {mode === "edit" ? (
          <>
            <EventSeriesLogoPreview
              logoUrl={values.logo_url}
              previewCacheKey={logoPreviewCacheKey}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Logo URL</span>
              <input
                type="text"
                value={values.logo_url}
                onChange={(e) => updateField("logo_url", e.target.value)}
                disabled={fieldsDisabled}
                className={formInputClass}
                placeholder="https://…"
              />
              <p className="text-xs text-slate-500">
                Event logos are manual-only. Paste an image URL to download and store in Supabase.
                Clear this field and save to remove the logo.
              </p>
            </label>

            <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-medium text-slate-900">Upload logo file</h3>
              <input
                key={logoFileInputKey}
                ref={logoFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                disabled={fieldsDisabled}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedLogoFile(file);
                  if (file) {
                    setLogoUploadResult(null);
                  }
                }}
              />
              {selectedLogoFile ? (
                <p className="text-sm text-slate-600">
                  Selected: {selectedLogoFile.name} ({formatFileSize(selectedLogoFile.size)})
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Choose a PNG, JPG, or WebP image up to 2 MB, then click Upload logo.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={logoUploadDisabled}
                onClick={() => void handleLogoUpload()}
              >
                {isUploadingLogo ? "Uploading…" : "Upload logo"}
              </Button>
              {logoUploadResult ? (
                <InlineErrorBanner
                  message={logoUploadResult.message}
                  variant={logoUploadResult.variant}
                />
              ) : null}
            </section>
          </>
        ) : null}

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Keywords</span>
          <SeriesKeywordMultiSelect
            keywords={allKeywords}
            selectedIds={keywordIds}
            onChange={setKeywordIds}
            disabled={fieldsDisabled}
          />
        </div>

        <Button type="submit" disabled={fieldsDisabled}>
          {isSubmitting ? "Saving…" : mode === "create" ? "Create event brand" : "Save changes"}
        </Button>
      </form>

      {result ? (
        <InlineErrorBanner
          className="mt-4"
          message={result.message}
          variant={result.variant ?? (result.ok ? "success" : "error")}
        />
      ) : null}

      <SlugChangeModal
        entityLabel="Event brand"
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
