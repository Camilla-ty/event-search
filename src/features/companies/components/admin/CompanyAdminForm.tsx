"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
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
  const router = useRouter();
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
  const [result, setResult] = useState<FormResult | null>(() => {
    const notice = initialNotice?.trim();
    if (!notice) return null;
    return { ok: true, message: notice, variant: "warning" };
  });
  const [slugModalOpen, setSlugModalOpen] = useState(false);

  const fieldsDisabled = isSubmitting || readOnly;

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

  const logoUrlHelper =
    "Manual override. Paste an external logo URL from a sponsor page; a stored copy is saved when import succeeds.";

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

        {mode === "edit" && readOnlyDomain ? (
          <p className="text-xs text-slate-600">
            Domain: <span className="font-mono">{readOnlyDomain}</span>
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
        ) : null}

        {mode === "edit" ? <CompanyLogoPreview metadata={logoMetadata} /> : null}

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
          <Button type="submit" disabled={isSubmitting}>
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
