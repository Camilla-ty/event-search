"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

import type { LiveSponsorRow } from "./EditionLiveSponsorsTable";

const TIER_RANK_MIN = 1;
const TIER_RANK_MAX = 1000;
const TIER_LABEL_MAX_LENGTH = 80;

type SponsorLinkDrawerProps = {
  row: LiveSponsorRow | null;
  onClose: () => void;
  onSaved: () => void;
};

function parseRankInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < TIER_RANK_MIN || n > TIER_RANK_MAX) return null;
  return n;
}

export function SponsorLinkDrawer({ row, onClose, onSaved }: SponsorLinkDrawerProps) {
  if (!row) return null;
  return (
    <SponsorLinkDrawerForm key={row.id} row={row} onClose={onClose} onSaved={onSaved} />
  );
}

type SponsorLinkDrawerFormProps = {
  row: LiveSponsorRow;
  onClose: () => void;
  onSaved: () => void;
};

function SponsorLinkDrawerForm({ row, onClose, onSaved }: SponsorLinkDrawerFormProps) {
  const originalLabel = row.tier_label ?? "";
  const originalRank = row.tier_rank !== null ? String(row.tier_rank) : "";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierLabel, setTierLabel] = useState(originalLabel);
  const [tierRank, setTierRank] = useState(originalRank);

  const company = row.companies;

  async function handleSave() {
    setError(null);

    const payload: { tier_rank?: number; tier_label?: string } = {};

    if (tierLabel.trim() !== originalLabel) {
      if (tierLabel.trim().length > TIER_LABEL_MAX_LENGTH) {
        setError(`Tier label must be at most ${TIER_LABEL_MAX_LENGTH} characters.`);
        return;
      }
      payload.tier_label = tierLabel.trim();
    }

    if (tierRank.trim() !== originalRank) {
      const rank = parseRankInput(tierRank);
      if (rank === null) {
        setError(
          `Tier rank is required and must be an integer between ${TIER_RANK_MIN} and ${TIER_RANK_MAX}.`,
        );
        return;
      }
      payload.tier_rank = rank;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event-sponsors/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save changes.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save changes.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit sponsor tier"
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit sponsor tier</h2>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <div>
            <p className="font-medium text-slate-900">{company?.name ?? "—"}</p>
            <p className="text-slate-600">{company?.domain ?? "—"}</p>
            {company?.id ? (
              <p className="mt-1">
                <Link
                  href={`/admin/companies/${company.id}`}
                  className="text-brand-primary hover:underline"
                >
                  View company
                </Link>
                <span className="ml-1 text-slate-500">
                  (name, logo, and profile are edited there)
                </span>
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="sponsor-tier-label"
              className="mb-1 block font-medium text-slate-700"
            >
              Tier label
            </label>
            <input
              id="sponsor-tier-label"
              className={formInputClass}
              value={tierLabel}
              maxLength={TIER_LABEL_MAX_LENGTH}
              placeholder="e.g. Gold"
              onChange={(e) => setTierLabel(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown on the public event page. Leave blank to clear.
            </p>
          </div>

          <div>
            <label
              htmlFor="sponsor-tier-rank"
              className="mb-1 block font-medium text-slate-700"
            >
              Tier rank
            </label>
            <input
              id="sponsor-tier-rank"
              className={formInputClass}
              type="number"
              min={TIER_RANK_MIN}
              max={TIER_RANK_MAX}
              step={1}
              value={tierRank}
              onChange={(e) => setTierRank(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Integer between {TIER_RANK_MIN} and {TIER_RANK_MAX}. Lower ranks appear
              first on the public page, and only rank 1 sponsors are visible to
              logged-out visitors.
            </p>
          </div>

          {error ? <InlineErrorBanner message={error} /> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
