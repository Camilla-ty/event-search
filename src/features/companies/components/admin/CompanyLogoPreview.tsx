"use client";

export type CompanyLogoMetadata = {
  logo_url: string;
  logo_source: string | null;
  logo_status: string | null;
  logo_fetched_at: string | null;
};

type CompanyLogoPreviewProps = {
  metadata: CompanyLogoMetadata;
};

function formatFetchedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function previewSrc(logoUrl: string, cacheKey: string | null): string {
  const trimmed = logoUrl.trim();
  if (!trimmed) return "";
  if (!cacheKey) return trimmed;
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=${encodeURIComponent(cacheKey)}`;
}

export function CompanyLogoPreview({ metadata }: CompanyLogoPreviewProps) {
  const previewUrl = previewSrc(metadata.logo_url, metadata.logo_fetched_at);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <span className="text-sm font-medium text-slate-700">Logo preview</span>

      {previewUrl ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Company logo preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">No stored logo yet.</p>
      )}

      <dl className="grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-500">Source</dt>
          <dd>{metadata.logo_source ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Status</dt>
          <dd>{metadata.logo_status ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Fetched</dt>
          <dd>{formatFetchedAt(metadata.logo_fetched_at)}</dd>
        </div>
      </dl>
    </div>
  );
}
