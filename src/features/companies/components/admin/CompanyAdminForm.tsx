"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button, InlineErrorBanner } from "@/src/components/common";
import { useAppRouter } from "@/src/lib/navigation/appRouter";
import { SlugChangeModal } from "@/src/features/admin/components/SlugChangeModal";
import {
  CompanyLogoPreview,
  type CompanyLogoMetadata,
} from "@/src/features/companies/components/admin/CompanyLogoPreview";
import {
  CompanyAliasesInput,
  type CompanyAliasesInputHandle,
} from "@/src/features/companies/components/admin/CompanyAliasesInput";
import type { CityOption } from "@/src/features/companies/server/getCityOptions";
import { AdminCitySelect } from "@/src/features/locations/components/AdminCitySelect";
import { feedbackSuccessClass, feedbackWarningClass, formInputClass } from "@/src/lib/design/classes";
import { slugify } from "@/src/lib/slugify";

const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

type CreateSubmitIntent = "another" | "edit";

type CompanyFormValues = {
  name: string;
  website: string;
  slug: string;
  city_id: string;
  logo_url: string;
  aliases: string[];
};

type CompanyAdminFormProps = {
  mode: "create" | "edit";
  companyId?: string;
  initial: CompanyFormValues;
  cities: CityOption[];
  readOnlyDomain?: string | null;
  readOnly?: boolean;
  initialNotice?: string | null;
  initialLogoMetadata?: CompanyLogoMetadata;
};

type FormResult = {
  ok: boolean;
  message: string;
  variant: "error" | "success" | "warning";
  createdCompany?: { id: string; name: string };
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  company?: {
    id: string;
    logo_url?: string | null;
    logo_source?: string | null;
    logo_status?: string | null;
    logo_fetched_at?: string | null;
    aliases?: string[];
  };
  warnings?: string[];
};

type UploadLogoResponse = {
  ok: boolean;
  error?: string;
  company?: {
    logo_url?: string | null;
    logo_source?: string | null;
    logo_status?: string | null;
    logo_fetched_at?: string | null;
  };
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

export function CompanyAdminForm({
  mode,
  companyId,
  initial,
  cities,
  readOnlyDomain,
  readOnly = false,
  initialNotice,
  initialLogoMetadata,
}: CompanyAdminFormProps) {
  const router = useAppRouter();
  const aliasesInputRef = useRef<CompanyAliasesInputHandle>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const createIntentRef = useRef<CreateSubmitIntent>("another");
  const [values, setValues] = useState<CompanyFormValues>(initial);
  const [logoMetadata, setLogoMetadata] = useState<CompanyLogoMetadata>(
    () =>
      initialLogoMetadata ?? {
        logo_url: initial.logo_url,
        logo_source: null,
        logo_status: null,
        logo_fetched_at: null,
      },
  );
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoFileInputKey, setLogoFileInputKey] = useState(0);
  const [logoUploadResult, setLogoUploadResult] = useState<{
    ok: boolean;
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<FormResult | null>(() => {
    const notice = initialNotice?.trim();
    if (!notice) return null;
    return { ok: true, message: notice, variant: "warning" };
  });
  const [slugModalOpen, setSlugModalOpen] = useState(false);

  const fieldsDisabled = isSubmitting || isUploadingLogo || readOnly;
  const logoUploadDisabled = selectedLogoFile === null || fieldsDisabled;

  const autoSlug = useMemo(() => slugify(values.name), [values.name]);
  const effectiveSlug = slugTouched ? values.slug : autoSlug;
  const slugChanged = mode === "edit" && effectiveSlug !== initial.slug;

  useEffect(() => {
    if (!result?.createdCompany || result.variant === "error") {
      return;
    }

    const timer = window.setTimeout(() => {
      setResult((prev) =>
        prev?.createdCompany ? null : prev,
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [result?.createdCompany, result?.variant]);

  function applySubmitResponse(data: ApiResponse, createIntent: CreateSubmitIntent = "edit") {
    if (data.ok && data.company && mode === "create") {
      if (createIntent === "another") {
        const createdName = values.name.trim() || "Company";
        const warning = data.warnings?.[0];
        setValues(initial);
        setSlugTouched(false);
        setResult({
          ok: true,
          message: warning ? `Created ${createdName}. ${warning}` : `Created ${createdName}.`,
          variant: warning ? "warning" : "success",
          createdCompany: { id: data.company.id, name: createdName },
        });
        window.requestAnimationFrame(() => {
          nameInputRef.current?.focus();
        });
        return;
      }

      const warning = data.warnings?.[0];
      const query = warning ? `?logoWarning=${encodeURIComponent(warning)}` : "";
      router.push(`/admin/companies/${data.company.id}${query}`);
      router.refresh();
      return;
    }

    if (data.ok && mode === "edit") {
      if (data.company?.logo_url !== undefined) {
        setValues((prev) => ({
          ...prev,
          logo_url: data.company?.logo_url ?? "",
        }));
      }
      if (
        data.company?.logo_source !== undefined ||
        data.company?.logo_status !== undefined ||
        data.company?.logo_fetched_at !== undefined
      ) {
        setLogoMetadata({
          logo_url: data.company?.logo_url ?? values.logo_url,
          logo_source: data.company?.logo_source ?? null,
          logo_status: data.company?.logo_status ?? null,
          logo_fetched_at: data.company?.logo_fetched_at ?? null,
        });
      }
      if (Array.isArray(data.company?.aliases)) {
        setValues((prev) => ({
          ...prev,
          aliases: [...data.company?.aliases ?? []],
        }));
      }
      const warning = data.warnings?.[0];
      setResult({
        ok: true,
        message: warning ?? "Company updated successfully.",
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

  function updateField<K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submitPayload() {
    const aliasesForSave =
      mode === "edit" ? (aliasesInputRef.current?.flushPending() ?? values.aliases) : values.aliases;

    if (mode === "create") {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          website: values.website,
          city_id: values.city_id.trim() || null,
          slug: effectiveSlug,
        }),
      });
      return (await response.json()) as ApiResponse;
    }

    const response = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        website: values.website,
        slug: effectiveSlug,
        city_id: values.city_id.trim() || null,
        logo_url: values.logo_url.trim() || null,
        aliases: aliasesForSave,
      }),
    });
    return (await response.json()) as ApiResponse;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    if (slugChanged && !slugModalOpen) {
      setSlugModalOpen(true);
      return;
    }

    const createIntent = mode === "create" ? createIntentRef.current : "edit";

    setResult(null);
    setIsSubmitting(true);
    try {
      applySubmitResponse(await submitPayload(), createIntent);
    } catch {
      setResult({ ok: false, message: "Request failed.", variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogoUpload() {
    if (!companyId || !selectedLogoFile) {
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

      const response = await fetch(`/api/admin/companies/${companyId}/logo`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as UploadLogoResponse;

      if (!response.ok || !data.ok || !data.company) {
        setLogoUploadResult({
          ok: false,
          message: data.error ?? "Logo upload failed.",
          variant: "error",
        });
        return;
      }

      const nextLogoUrl = data.company.logo_url ?? "";
      setValues((prev) => ({ ...prev, logo_url: nextLogoUrl }));
      setLogoMetadata({
        logo_url: nextLogoUrl,
        logo_source: data.company.logo_source ?? null,
        logo_status: data.company.logo_status ?? null,
        logo_fetched_at: data.company.logo_fetched_at ?? null,
      });
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

  const logoUrlHelper =
    "Import from URL. Paste an external logo URL from a sponsor page; a stored copy is saved when import succeeds.";

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Company name</span>
          <input
            ref={nameInputRef}
            type="text"
            required
            value={values.name}
            onChange={(e) => updateField("name", e.target.value)}
            disabled={fieldsDisabled}
            className={formInputClass}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Website</span>
          <input
            type="text"
            required
            value={values.website}
            onChange={(e) => updateField("website", e.target.value)}
            disabled={fieldsDisabled}
            className={formInputClass}
            placeholder="https://acme.com"
          />
          <p className="text-xs text-slate-500">Required. Used to derive the company domain.</p>
        </label>

        {mode === "edit" ? (
          <p className="text-xs text-slate-600">
            Domain:{" "}
            <span className="font-mono">{readOnlyDomain?.trim() ? readOnlyDomain : "—"}</span>
          </p>
        ) : null}

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
          <p className="text-xs text-slate-500">Public path: /sponsors/{effectiveSlug || "…"}</p>
        </label>

        <AdminCitySelect
          value={values.city_id}
          onChange={(cityId) => updateField("city_id", cityId)}
          initialCities={cities}
          disabled={fieldsDisabled}
          emptyLabel="No city / Unknown"
        />

        {mode === "edit" ? (
          <>
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
              <p className="text-xs text-slate-500">{logoUrlHelper}</p>
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

            <CompanyLogoPreview metadata={logoMetadata} />
          </>
        ) : null}

        {mode === "edit" ? (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Aliases</span>
              <CompanyAliasesInput
                ref={aliasesInputRef}
                value={values.aliases}
                onChange={(aliases) => updateField("aliases", aliases)}
                canonicalName={values.name}
                disabled={fieldsDisabled}
              />
            </div>
          </>
        ) : null}

        {mode === "create" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={fieldsDisabled}
              onClick={() => {
                createIntentRef.current = "another";
              }}
            >
              {isSubmitting ? "Saving…" : "Save & create another"}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={fieldsDisabled}
              onClick={() => {
                createIntentRef.current = "edit";
              }}
            >
              Create company & edit
            </Button>
          </div>
        ) : readOnly ? null : (
          <Button type="submit" disabled={fieldsDisabled}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        )}
      </form>

      {result?.createdCompany ? (
        <div
          role="status"
          className={[
            result.variant === "warning" ? feedbackWarningClass : feedbackSuccessClass,
            "mt-4 text-sm",
          ].join(" ")}
        >
          <span>{result.message}</span>{" "}
          <Link
            href={`/admin/companies/${result.createdCompany.id}`}
            className="font-medium text-brand-primary hover:underline"
          >
            Edit {result.createdCompany.name} →
          </Link>
        </div>
      ) : result ? (
        <InlineErrorBanner
          className="mt-4"
          message={result.message}
          variant={result.variant}
        />
      ) : null}

      <SlugChangeModal
        entityLabel="Company"
        oldSlug={initial.slug}
        newSlug={effectiveSlug}
        publicPathPrefix="/sponsors/"
        open={slugModalOpen}
        onCancel={() => setSlugModalOpen(false)}
        onConfirm={async () => {
          setSlugModalOpen(false);
          setResult(null);
          setIsSubmitting(true);
          const createIntent = mode === "create" ? createIntentRef.current : "edit";
          try {
            applySubmitResponse(await submitPayload(), createIntent);
          } catch {
            setResult({ ok: false, message: "Request failed.", variant: "error" });
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </>
  );
}
