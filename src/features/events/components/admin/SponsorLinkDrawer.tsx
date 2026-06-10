"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

import type { LiveSponsorRow } from "./EditionLiveSponsorsTable";

const TIER_RANK_MIN = 1;
const TIER_RANK_MAX = 1000;
const TIER_LABEL_MAX_LENGTH = 80;
const SEARCH_MIN_CHARS = 2;

type SponsorLinkDrawerProps =
  | {
      mode: "edit";
      row: LiveSponsorRow;
      onClose: () => void;
      onSaved: () => void;
    }
  | {
      mode: "create";
      editionId: string;
      attachedCompanyIds: ReadonlySet<string>;
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

export function SponsorLinkDrawer(props: SponsorLinkDrawerProps) {
  if (props.mode === "edit") {
    return (
      <EditSponsorForm
        key={props.row.id}
        row={props.row}
        onClose={props.onClose}
        onSaved={props.onSaved}
      />
    );
  }
  return (
    <AddSponsorForm
      editionId={props.editionId}
      attachedCompanyIds={props.attachedCompanyIds}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

type DrawerShellProps = {
  title: string;
  saving: boolean;
  saveLabel: string;
  saveDisabled: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

function DrawerShell({
  title,
  saving,
  saveLabel,
  saveDisabled,
  onClose,
  onSave,
  children,
}: DrawerShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">{children}</div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || saveDisabled}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

type TierFieldsProps = {
  tierLabel: string;
  tierRank: string;
  rankRequired: boolean;
  onLabelChange: (value: string) => void;
  onRankChange: (value: string) => void;
};

function TierFields({
  tierLabel,
  tierRank,
  rankRequired,
  onLabelChange,
  onRankChange,
}: TierFieldsProps) {
  return (
    <>
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
          onChange={(e) => onLabelChange(e.target.value)}
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
          Tier rank{rankRequired ? " *" : ""}
        </label>
        <input
          id="sponsor-tier-rank"
          className={formInputClass}
          type="number"
          min={TIER_RANK_MIN}
          max={TIER_RANK_MAX}
          step={1}
          value={tierRank}
          onChange={(e) => onRankChange(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Integer between {TIER_RANK_MIN} and {TIER_RANK_MAX}. Lower ranks appear
          first on the public page, and only rank 1 sponsors are visible to
          logged-out visitors.
        </p>
      </div>
    </>
  );
}

type EditSponsorFormProps = {
  row: LiveSponsorRow;
  onClose: () => void;
  onSaved: () => void;
};

function EditSponsorForm({ row, onClose, onSaved }: EditSponsorFormProps) {
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
    <DrawerShell
      title="Edit sponsor tier"
      saving={saving}
      saveLabel="Save"
      saveDisabled={false}
      onClose={onClose}
      onSave={() => void handleSave()}
    >
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

      <TierFields
        tierLabel={tierLabel}
        tierRank={tierRank}
        rankRequired={false}
        onLabelChange={setTierLabel}
        onRankChange={setTierRank}
      />

      {error ? <InlineErrorBanner message={error} /> : null}
    </DrawerShell>
  );
}

type CompanyOption = { id: string; name: string; domain: string | null };

type AddSponsorFormProps = {
  editionId: string;
  attachedCompanyIds: ReadonlySet<string>;
  onClose: () => void;
  onSaved: () => void;
};

function AddSponsorForm({
  editionId,
  attachedCompanyIds,
  onClose,
  onSaved,
}: AddSponsorFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [lastFetchedTerm, setLastFetchedTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [tierLabel, setTierLabel] = useState("");
  const [tierRank, setTierRank] = useState("");

  const term = companySearch.trim();

  useEffect(() => {
    if (term.length < SEARCH_MIN_CHARS) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/companies?search=${encodeURIComponent(term)}`,
        );
        const data = (await res.json()) as {
          ok: boolean;
          companies?: Array<Record<string, unknown>>;
        };
        if (cancelled || !data.ok || !Array.isArray(data.companies)) return;
        setCompanyOptions(
          data.companies.map((c) => ({
            id: String(c.id),
            name: typeof c.name === "string" ? c.name : "—",
            domain: typeof c.domain === "string" ? c.domain : null,
          })),
        );
        setLastFetchedTerm(term);
      } catch {
        // Ignore network failures during typing; submit reports real errors.
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const visibleOptions = term.length >= SEARCH_MIN_CHARS ? companyOptions : [];
  const selectableCount = visibleOptions.reduce(
    (count, option) => (attachedCompanyIds.has(option.id) ? count : count + 1),
    0,
  );
  const showNoResultsHint =
    term.length >= SEARCH_MIN_CHARS && lastFetchedTerm === term && selectableCount === 0;

  const parsedRank = parseRankInput(tierRank);
  const saveDisabled = selectedCompany === null || parsedRank === null;

  async function handleSave() {
    if (selectedCompany === null || parsedRank === null) return;
    setError(null);

    if (tierLabel.trim().length > TIER_LABEL_MAX_LENGTH) {
      setError(`Tier label must be at most ${TIER_LABEL_MAX_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event-editions/${editionId}/sponsors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompany.id,
          tier_rank: parsedRank,
          tier_label: tierLabel.trim() === "" ? null : tierLabel.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to add sponsor.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Failed to add sponsor.");
      setSaving(false);
    }
  }

  return (
    <DrawerShell
      title="Add sponsor"
      saving={saving}
      saveLabel="Add sponsor"
      saveDisabled={saveDisabled}
      onClose={onClose}
      onSave={() => void handleSave()}
    >
      <div>
        <label
          htmlFor="sponsor-company-search"
          className="mb-1 block font-medium text-slate-700"
        >
          Company *
        </label>
        <input
          id="sponsor-company-search"
          className={formInputClass}
          placeholder="Search companies…"
          value={companySearch}
          onChange={(e) => setCompanySearch(e.target.value)}
        />
        {visibleOptions.length > 0 ? (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-200">
            {visibleOptions.map((option) => {
              const attached = attachedCompanyIds.has(option.id);
              const selected = selectedCompany?.id === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={attached}
                    className={[
                      "w-full px-3 py-2 text-left",
                      attached
                        ? "cursor-not-allowed text-slate-400"
                        : "hover:bg-slate-50",
                      selected ? "bg-brand-primary-muted" : "",
                    ].join(" ")}
                    onClick={() => setSelectedCompany(option)}
                  >
                    {option.name}
                    {option.domain ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {option.domain}
                      </span>
                    ) : null}
                    {attached ? (
                      <span className="ml-2 text-xs">Already on this edition</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {showNoResultsHint ? (
          <p className="mt-2 text-xs text-slate-500">
            Can&apos;t find the company?{" "}
            <Link
              href="/admin/companies/new"
              className="text-brand-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create it in Companies ↗
            </Link>{" "}
            then search for it here.
          </p>
        ) : null}
        {selectedCompany ? (
          <p className="mt-2 text-xs text-slate-600">
            Selected: <span className="font-medium">{selectedCompany.name}</span>
          </p>
        ) : null}
      </div>

      <TierFields
        tierLabel={tierLabel}
        tierRank={tierRank}
        rankRequired
        onLabelChange={setTierLabel}
        onRankChange={setTierRank}
      />

      {error ? <InlineErrorBanner message={error} /> : null}
    </DrawerShell>
  );
}
