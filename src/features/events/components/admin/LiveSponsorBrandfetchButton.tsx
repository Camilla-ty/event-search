"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/common";
import {
  brandfetchUpgradeFailureMessage,
  brandfetchUpgradeSkipMessage,
} from "@/src/lib/companies/brandfetchUpgradeMessages";
import type { BrandfetchUpgradeApiResponse } from "@/src/lib/companies/brandfetchUpgradeTypes";
import { canUpgradeCompanyBrandfetchLogo } from "@/src/lib/companies/companyHasBrandfetchLogo";
import { secondaryCtaClass } from "@/src/lib/design/classes";

type LiveSponsorBrandfetchButtonProps = {
  companyId: string;
  companyName: string;
  domain: string | null;
  logoUrl: string | null;
  logoSource: string | null;
  logoStatus: string | null;
  disabled?: boolean;
};

export function LiveSponsorBrandfetchButton({
  companyId,
  companyName,
  domain,
  logoUrl,
  logoSource,
  logoStatus,
  disabled = false,
}: LiveSponsorBrandfetchButtonProps) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<string | null>(null);

  const eligible = canUpgradeCompanyBrandfetchLogo({
    domain,
    logo_url: logoUrl,
    logo_source: logoSource,
    logo_status: logoStatus,
  });

  useEffect(() => {
    if (confirmOpen) {
      cancelRef.current?.focus();
    }
  }, [confirmOpen]);

  if (!eligible) {
    return null;
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    setRowMessage(null);

    try {
      const response = await fetch("/api/admin/companies/brandfetch-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_ids: [companyId] }),
      });

      const data = (await response.json()) as BrandfetchUpgradeApiResponse;
      if (!data.ok) {
        setError(data.error ?? "Brandfetch upgrade request failed.");
        setLoading(false);
        return;
      }

      const item = data.results[0];
      if (!item) {
        setError("Brandfetch upgrade returned no result.");
        setLoading(false);
        return;
      }

      setConfirmOpen(false);

      if (item.status === "upgraded") {
        setRowMessage("Brandfetch logo stored.");
        router.refresh();
        return;
      }

      if (item.status === "skipped") {
        setRowMessage(brandfetchUpgradeSkipMessage(item.reason));
        return;
      }

      setRowMessage(brandfetchUpgradeFailureMessage(item.reason, item.message));
    } catch {
      setError("Brandfetch upgrade request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || loading}
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
        >
          Brandfetch
        </Button>
        {rowMessage ? (
          <span className="max-w-[10rem] text-right text-[11px] text-slate-500">{rowMessage}</span>
        ) : null}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-sponsor-brandfetch-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="live-sponsor-brandfetch-title"
              className="text-lg font-semibold text-slate-900"
            >
              Upgrade logo with Brandfetch?
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Download and store the Brandfetch logo for{" "}
              <span className="font-medium text-slate-900">{companyName}</span>. Manual logos and
              companies that already have Brandfetch logos are not replaced.
            </p>
            {loading ? (
              <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
                Downloading logo from Brandfetch…
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                className={`${secondaryCtaClass} h-8 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
                onClick={() => {
                  if (loading) return;
                  setConfirmOpen(false);
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <Button type="button" onClick={() => void handleConfirm()} disabled={loading}>
                {loading ? "Upgrading…" : "Confirm upgrade"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
