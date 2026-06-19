"use client";

import { useRef, useState } from "react";

import { AdminDrawerShell } from "@/src/features/admin/components/AdminDrawerShell";
import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

import type { LiveSponsorCompanyLogoUpdate, LiveSponsorRow } from "./liveSponsorTypes";

type CompanyLogoDrawerProps = {
  row: LiveSponsorRow;
  onClose: () => void;
  onUpdated: (companyId: string, update: LiveSponsorCompanyLogoUpdate) => void;
};

type PatchCompanyLogoResponse = {
  ok: boolean;
  error?: string;
  company?: {
    logo_url?: string | null;
    logo_source?: string | null;
    logo_status?: string | null;
    logo_fetched_at?: string | null;
  };
  warnings?: string[];
};

const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

function previewSrc(logoUrl: string | null, cacheKey: string | null): string {
  const trimmed = logoUrl?.trim() ?? "";
  if (!trimmed) return "";
  if (!cacheKey) return trimmed;
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=${encodeURIComponent(cacheKey)}`;
}

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

export function CompanyLogoDrawer({ row, onClose, onUpdated }: CompanyLogoDrawerProps) {
  const company = row.companies;
  const companyId = company?.id ?? "";
  const companyName = company?.name?.trim() || "—";
  const domain = company?.domain?.trim() || null;

  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storedLogoUrl, setStoredLogoUrl] = useState(company?.logo_url ?? null);
  const [previewCacheKey, setPreviewCacheKey] = useState<string | null>(null);

  if (!company?.id) {
    return null;
  }

  const previewUrl = previewSrc(storedLogoUrl, previewCacheKey);
  const saveDisabled = logoUrlInput.trim() === "" || isUploading;
  const actionsDisabled = saving || isUploading;
  const uploadDisabled = selectedFile === null || actionsDisabled;

  function applyLogoUpdate(update: LiveSponsorCompanyLogoUpdate, cacheKey: string) {
    setStoredLogoUrl(update.logo_url);
    setPreviewCacheKey(cacheKey);
    onUpdated(companyId, update);
  }

  async function handleSave() {
    const trimmedInput = logoUrlInput.trim();
    if (trimmedInput === "") {
      return;
    }

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ logo_url: trimmedInput }),
      });
      const data = (await response.json()) as PatchCompanyLogoResponse;
      if (!response.ok || !data.ok || !data.company) {
        setError(data.error ?? "Failed to save logo.");
        setSaving(false);
        return;
      }

      const cacheKey = data.company.logo_fetched_at ?? new Date().toISOString();
      applyLogoUpdate(
        {
          logo_url: data.company.logo_url ?? null,
          logo_source: data.company.logo_source ?? null,
          logo_status: data.company.logo_status ?? null,
          logo_fetched_at: data.company.logo_fetched_at ?? null,
        },
        cacheKey,
      );
      setLogoUrlInput("");
      setSuccess(data.warnings?.[0] ?? "Logo saved.");
    } catch {
      setError("Failed to save logo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    const validationError = validateLogoUploadFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const response = await fetch(`/api/admin/companies/${companyId}/logo`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as PatchCompanyLogoResponse;
      if (!response.ok || !data.ok || !data.company) {
        setError(data.error ?? "Logo upload failed.");
        return;
      }

      const cacheKey = data.company.logo_fetched_at ?? new Date().toISOString();
      applyLogoUpdate(
        {
          logo_url: data.company.logo_url ?? null,
          logo_source: data.company.logo_source ?? null,
          logo_status: data.company.logo_status ?? null,
          logo_fetched_at: data.company.logo_fetched_at ?? null,
        },
        cacheKey,
      );
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSuccess("Logo uploaded.");
    } catch {
      setError("Logo upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AdminDrawerShell
      title="Logo"
      saving={actionsDisabled}
      saveLabel="Import from URL"
      saveDisabled={saveDisabled}
      onClose={onClose}
      onSave={() => void handleSave()}
    >
      <div>
        <p className="font-medium text-slate-900">{companyName}</p>
        {domain ? <p className="text-slate-600">{domain}</p> : null}
        <p className="mt-2 text-sm text-slate-600">
          Two ways to set the logo. Each action saves immediately.
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-slate-700">Current logo</p>
        {previewUrl ? (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={companyName.trim() ? `${companyName.trim()} logo` : "Company logo"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No logo stored yet.</p>
        )}
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="font-medium text-slate-900">Import from URL</h3>
        <label className="block space-y-2">
          <span className="sr-only">Logo image URL</span>
          <input
            type="url"
            value={logoUrlInput}
            onChange={(event) => setLogoUrlInput(event.target.value)}
            disabled={actionsDisabled}
            className={formInputClass}
            placeholder="https://example.com/logo.png"
            autoComplete="off"
          />
          <p className="text-xs text-slate-500">
            Paste a direct image URL (PNG, JPG, or WebP). Click Import from URL to download and
            store it.
          </p>
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <h3 className="font-medium text-slate-900">Upload file</h3>
        <input
          key={fileInputKey}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          disabled={actionsDisabled}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
            if (file) {
              setError(null);
              setSuccess(null);
            }
          }}
        />
        {selectedFile ? (
          <p className="text-sm text-slate-600">
            Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        ) : null}
        <p className="text-xs text-slate-500">
          Choose a file, then click Upload file. The logo is saved immediately — you don&apos;t need
          Import from URL.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploadDisabled}
          onClick={() => void handleUpload()}
        >
          {isUploading ? "Uploading…" : "Upload file"}
        </Button>
      </section>

      {error ? <InlineErrorBanner message={error} /> : null}
      {success ? <InlineErrorBanner message={success} variant="success" /> : null}
    </AdminDrawerShell>
  );
}
