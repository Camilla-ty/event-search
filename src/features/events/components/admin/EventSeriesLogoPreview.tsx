"use client";

import { resolveStorageLogoDisplayUrl } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

type EventSeriesLogoPreviewProps = {
  logoUrl: string;
  previewCacheKey?: string | null;
};

function previewSrc(logoUrl: string, cacheKey: string | null | undefined): string {
  const trimmed = resolveStorageLogoDisplayUrl(logoUrl) ?? "";
  if (!trimmed) return "";
  if (!cacheKey) return trimmed;
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=${encodeURIComponent(cacheKey)}`;
}

export function EventSeriesLogoPreview({
  logoUrl,
  previewCacheKey,
}: EventSeriesLogoPreviewProps) {
  const previewUrl = previewSrc(logoUrl, previewCacheKey);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <span className="text-sm font-medium text-slate-700">Logo preview</span>

      {previewUrl ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Event brand logo preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">No stored logo yet.</p>
      )}
    </div>
  );
}
