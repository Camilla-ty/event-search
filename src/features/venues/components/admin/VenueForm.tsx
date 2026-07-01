"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { SlugChangeModal } from "@/src/features/admin/components/SlugChangeModal";
import type { CityOption } from "@/src/features/companies/server/getCityOptions";
import { buildVenueGoogleMapsUrl } from "@/src/features/venues/lib/buildGoogleMapsUrl";
import { AdminCitySelect } from "@/src/features/locations/components/AdminCitySelect";
import { formInputClass } from "@/src/lib/design/classes";
import { slugify } from "@/src/lib/slugify";

const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

type VenueFormValues = {
  name: string;
  slug: string;
  city_id: string;
  website_url: string;
  address_text: string;
  logo_url: string;
};

type VenueFormProps = {
  mode: "create" | "edit";
  venueId?: string;
  initial: VenueFormValues;
  cities: CityOption[];
  linkedEditionCount?: number;
  cityLabel?: string;
  initialNotice?: string | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  warnings?: string[];
  venue?: { id: string; logo_url?: string | null };
};

type UploadLogoResponse = {
  ok: boolean;
  error?: string;
  venue?: { logo_url?: string | null };
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

function previewSrc(logoUrl: string, cacheKey: string | null | undefined): string {
  const trimmed = logoUrl.trim();
  if (!trimmed) return "";
  if (!cacheKey) return trimmed;
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=${encodeURIComponent(cacheKey)}`;
}

function VenueLogoPreview({
  logoUrl,
  previewCacheKey,
}: {
  logoUrl: string;
  previewCacheKey?: string | null;
}) {
  const previewUrl = previewSrc(logoUrl, previewCacheKey);
  if (previewUrl === "") {
    return <p className="text-sm text-slate-500">No logo URL set.</p>;
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt="Venue logo preview"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function VenueForm({
  mode,
  venueId,
  initial,
  cities,
  linkedEditionCount = 0,
  cityLabel = "",
  initialNotice,
}: VenueFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<VenueFormValues>(initial);
  const [localCities, setLocalCities] = useState(cities);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    variant?: "success" | "warning" | "error";
  } | null>(() => {
    const notice = initialNotice?.trim();
    if (!notice) return null;
    return { ok: true, message: notice, variant: "warning" };
  });
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
  const cityLocked = mode === "edit" && linkedEditionCount > 0;
  const fieldsDisabled = isSubmitting || isUploadingLogo;
  const logoUploadDisabled = selectedLogoFile === null || fieldsDisabled;

  const mapUrl = useMemo(
    () =>
      mode === "edit"
        ? buildVenueGoogleMapsUrl({
            name: values.name,
            addressText: values.address_text,
            cityLabel,
          })
        : null,
    [mode, values.name, values.address_text, cityLabel],
  );

  function updateField<K extends keyof VenueFormValues>(key: K, value: VenueFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submitPayload() {
    const payload = {
      name: values.name.trim(),
      slug: effectiveSlug,
      city_id: values.city_id,
      website_url: values.website_url.trim() || null,
      address_text: values.address_text.trim() || null,
      logo_url: values.logo_url.trim() || null,
    };

    const url = mode === "create" ? "/api/admin/venues" : `/api/admin/venues/${venueId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await response.json()) as ApiResponse;
  }

  function applySubmitResponse(data: ApiResponse) {
    if (data.ok && data.venue && mode === "create") {
      const warning = data.warnings?.[0];
      const query = warning ? `?warning=${encodeURIComponent(warning)}` : "";
      router.push(`/admin/venues/${data.venue.id}${query}`);
      router.refresh();
      return;
    }

    if (data.ok && mode === "edit") {
      if (data.venue?.logo_url !== undefined) {
        setValues((prev) => ({
          ...prev,
          logo_url: data.venue?.logo_url ?? "",
        }));
      }
      setSlugModalOpen(false);
      const warning = data.warnings?.[0];
      setResult({
        ok: true,
        message: warning ?? "Venue updated successfully.",
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
    if (!venueId || !selectedLogoFile) {
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

      const response = await fetch(`/api/admin/venues/${venueId}/logo`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as UploadLogoResponse;

      if (!response.ok || !data.ok || !data.venue) {
        setLogoUploadResult({
          ok: false,
          message: data.error ?? "Logo upload failed.",
          variant: "error",
        });
        return;
      }

      const nextLogoUrl = data.venue.logo_url ?? "";
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
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        {result ? (
          <InlineErrorBanner message={result.message} variant={result.variant ?? "error"} />
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            type="text"
            required
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
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
            onChange={(event) => {
              setSlugTouched(true);
              updateField("slug", event.target.value);
            }}
            disabled={fieldsDisabled}
            className={formInputClass}
          />
          <p className="text-xs text-slate-500">
            Auto-generated from name until you edit it. Venues have no public profile pages in v1.
          </p>
        </label>

        <div className="space-y-2">
          {cityLocked ? (
            <>
              <span className="text-sm font-medium text-slate-700">City</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {cityLabel || values.city_id}
                <p className="mt-1 text-xs text-slate-500">
                  City cannot be changed while editions are linked. Create a new venue to record a
                  relocation.
                </p>
              </div>
            </>
          ) : (
            <AdminCitySelect
              value={values.city_id}
              onChange={(cityId) => updateField("city_id", cityId)}
              initialCities={localCities}
              disabled={fieldsDisabled}
              onCityCreated={(city) => {
                setLocalCities((prev) => {
                  if (prev.some((option) => option.id === city.id)) return prev;
                  return [...prev, city].sort((a, b) => a.label.localeCompare(b.label));
                });
              }}
            />
          )}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Website URL</span>
          <input
            type="url"
            value={values.website_url}
            onChange={(event) => updateField("website_url", event.target.value)}
            disabled={fieldsDisabled}
            placeholder="https://example.com"
            className={formInputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Address</span>
          <textarea
            value={values.address_text}
            onChange={(event) => updateField("address_text", event.target.value)}
            disabled={fieldsDisabled}
            rows={3}
            className={formInputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Logo URL</span>
          <input
            type="url"
            value={values.logo_url}
            onChange={(event) => updateField("logo_url", event.target.value)}
            disabled={fieldsDisabled}
            placeholder="https://example.com/logo.png"
            className={formInputClass}
          />
          <p className="text-xs text-slate-500">
            {mode === "edit"
              ? "Paste an image URL and save, or upload a file below. Clear this field and save to remove the logo."
              : "Optional. Paste a logo URL on create, or upload a file after the venue is created."}
          </p>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Logo preview</span>
          <VenueLogoPreview logoUrl={values.logo_url} previewCacheKey={logoPreviewCacheKey} />
        </div>

        {mode === "edit" ? (
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
        ) : null}

        {mode === "edit" && mapUrl ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-medium text-slate-700">Map preview</span>
            <p className="text-sm text-slate-600">
              Opens a Google Maps search built from the venue name, address, and city.
            </p>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              Open in Google Maps ↗
            </a>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={fieldsDisabled || (mode === "create" && !values.city_id)}>
            {isSubmitting
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create venue"
                : "Save changes"}
          </Button>
        </div>
      </form>

      <SlugChangeModal
        entityLabel="Venue"
        oldSlug={initial.slug}
        newSlug={effectiveSlug}
        publicPathPrefix="(internal slug) "
        open={slugModalOpen}
        onCancel={() => setSlugModalOpen(false)}
        onConfirm={confirmSlugAndSave}
      />
    </>
  );
}
