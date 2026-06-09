"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { SlugChangeModal } from "@/src/features/admin/components/SlugChangeModal";
import type { CityOption } from "@/src/features/companies/server/getCityOptions";
import { AdminCitySelect } from "@/src/features/locations/components/AdminCitySelect";
import { formInputClass } from "@/src/lib/design/classes";
import { slugify } from "@/src/lib/slugify";

type CompanyFormValues = {
  name: string;
  website: string;
  slug: string;
  city_id: string;
  logo_url: string;
  short_description: string;
  description: string;
};

type CompanyAdminFormProps = {
  mode: "create" | "edit";
  companyId?: string;
  initial: CompanyFormValues;
  cities: CityOption[];
  readOnlyDomain?: string | null;
};

type ApiResponse = { ok: boolean; error?: string; company?: { id: string } };

export function CompanyAdminForm({
  mode,
  companyId,
  initial,
  cities,
  readOnlyDomain,
}: CompanyAdminFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [slugModalOpen, setSlugModalOpen] = useState(false);

  const autoSlug = useMemo(() => slugify(values.name), [values.name]);
  const effectiveSlug = slugTouched ? values.slug : autoSlug;
  const slugChanged = mode === "edit" && effectiveSlug !== initial.slug;

  function updateField<K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submitPayload() {
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
        short_description: values.short_description.trim() || null,
        description: values.description.trim() || null,
      }),
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
      if (data.ok && data.company) {
        router.push(`/admin/companies/${data.company.id}`);
        router.refresh();
        return;
      }
      if (data.ok && mode === "edit") {
        setResult({ ok: true, message: "Company updated successfully." });
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

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Company name</span>
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
          <span className="text-sm font-medium text-slate-700">Website</span>
          <input
            type="text"
            required
            value={values.website}
            onChange={(e) => updateField("website", e.target.value)}
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            className={formInputClass}
          />
          <p className="text-xs text-slate-500">Public path: /sponsors/{effectiveSlug || "…"}</p>
        </label>

        <AdminCitySelect
          value={values.city_id}
          onChange={(cityId) => updateField("city_id", cityId)}
          initialCities={cities}
          disabled={isSubmitting}
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
                disabled={isSubmitting}
                className={formInputClass}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Short description</span>
              <input
                type="text"
                value={values.short_description}
                onChange={(e) => updateField("short_description", e.target.value)}
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
                rows={4}
                className={formInputClass}
              />
            </label>
          </>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create company"
              : "Save changes"}
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
        entityLabel="Company"
        oldSlug={initial.slug}
        newSlug={effectiveSlug}
        publicPathPrefix="/sponsors/"
        open={slugModalOpen}
        onCancel={() => setSlugModalOpen(false)}
        onConfirm={async () => {
          setSlugModalOpen(false);
          setIsSubmitting(true);
          try {
            const data = await submitPayload();
            if (data.ok) {
              if (mode === "create" && data.company) {
                router.push(`/admin/companies/${data.company.id}`);
              } else {
                setResult({ ok: true, message: "Company updated successfully." });
                router.refresh();
              }
            } else {
              setResult({ ok: false, message: data.error ?? "Request failed." });
            }
          } catch {
            setResult({ ok: false, message: "Request failed." });
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </>
  );
}
