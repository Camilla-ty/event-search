"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, InlineErrorBanner } from "@/src/components/common";
import {
  brandfetchUpgradeFailureMessage,
  brandfetchUpgradeSkipMessage,
} from "@/src/lib/companies/brandfetchUpgradeMessages";
import type { BrandfetchUpgradeApiResponse } from "@/src/lib/companies/brandfetchUpgradeTypes";
import {
  canUpgradeCompanyBrandfetchLogo,
  isBrandfetchCompanyLogoSource,
} from "@/src/lib/companies/companyHasBrandfetchLogo";

export type CompanyLogoMetadata = {
  logo_url: string;
  logo_source: string | null;
  logo_status: string | null;
  logo_fetched_at: string | null;
};

type CompanyBrandfetchLogoUpgradeProps = {
  companyId: string;
  domain: string | null;
  metadata: CompanyLogoMetadata;
  onMetadataChange: (metadata: CompanyLogoMetadata) => void;
  disabled?: boolean;
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

export function CompanyBrandfetchLogoUpgrade({
  companyId,
  domain,
  metadata,
  onMetadataChange,
  disabled = false,
}: CompanyBrandfetchLogoUpgradeProps) {
  const router = useRouter();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [previewCacheKey, setPreviewCacheKey] = useState<string | null>(null);
  const [result, setResult] = useState<{
    variant: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const canUpgrade = canUpgradeCompanyBrandfetchLogo({
    domain,
    logo_source: metadata.logo_source,
    logo_status: metadata.logo_status,
    logo_url: metadata.logo_url,
  });

  const showBrandfetchBadge = isBrandfetchCompanyLogoSource(metadata.logo_source);
  const previewUrl = previewSrc(metadata.logo_url, previewCacheKey);

  async function handleUpgrade() {
    setResult(null);
    setIsUpgrading(true);

    try {
      const response = await fetch("/api/admin/companies/brandfetch-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_ids: [companyId] }),
      });

      const data = (await response.json()) as BrandfetchUpgradeApiResponse;
      if (!data.ok) {
        setResult({
          variant: "error",
          message: data.error ?? "Brandfetch upgrade request failed.",
        });
        return;
      }

      const item = data.results[0];
      if (!item) {
        setResult({
          variant: "error",
          message: "Brandfetch upgrade returned no result.",
        });
        return;
      }

      if (item.status === "upgraded") {
        const fetchedAt = new Date().toISOString();
        onMetadataChange({
          logo_url: item.logoUrl,
          logo_source: "brandfetch",
          logo_status: "ok",
          logo_fetched_at: fetchedAt,
        });
        setPreviewCacheKey(fetchedAt);
        setResult({
          variant: "success",
          message: "Brandfetch logo downloaded and stored.",
        });
        router.refresh();
        return;
      }

      if (item.status === "skipped") {
        setResult({
          variant: "warning",
          message: brandfetchUpgradeSkipMessage(item.reason),
        });
        return;
      }

      setResult({
        variant: "error",
        message: brandfetchUpgradeFailureMessage(item.reason, item.message),
      });
    } catch {
      setResult({
        variant: "error",
        message: "Brandfetch upgrade request failed.",
      });
    } finally {
      setIsUpgrading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Logo preview</span>
        {showBrandfetchBadge ? <Badge variant="accent">Brandfetch</Badge> : null}
      </div>

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

      {canUpgrade ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || isUpgrading}
          onClick={() => void handleUpgrade()}
        >
          {isUpgrading ? "Downloading…" : "Download Brandfetch logo"}
        </Button>
      ) : null}

      {result ? (
        <InlineErrorBanner message={result.message} variant={result.variant} />
      ) : null}
    </div>
  );
}
