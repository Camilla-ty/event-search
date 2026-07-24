"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InlineErrorBanner } from "@/src/components/common";
import { AdminDrawerShell } from "@/src/features/admin/components/AdminDrawerShell";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import type {
  EventExhibitorLinkAdminRow,
  LiveExhibitorRow,
} from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { formInputClass } from "@/src/lib/design/classes";

const TIER_RANK_MIN = 1;
const TIER_RANK_MAX = 1000;
const TIER_LABEL_MAX_LENGTH = 80;
const SEARCH_MIN_CHARS = 2;

type CompanyOption = {
  id: string;
  name: string;
  domain: string | null;
  matched_alias?: string | null;
};

export type ExhibitorCreateSavedPayload = {
  link: EventExhibitorLinkAdminRow;
  company: CompanyOption;
};

export type ExhibitorEditSavedPayload = {
  link: EventExhibitorLinkAdminRow;
  kind: "label" | "tier";
};

type ExhibitorLinkDrawerProps =
  | {
      mode: "edit";
      row: LiveExhibitorRow;
      onClose: () => void;
      onSaved: (payload: ExhibitorEditSavedPayload) => void;
    }
  | {
      mode: "create";
      editionId: string;
      attachedCompanyIds: ReadonlySet<string>;
      onClose: () => void;
      onSaved: (payload: ExhibitorCreateSavedPayload) => void;
    };

function parseRankInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < TIER_RANK_MIN || n > TIER_RANK_MAX) return null;
  return n;
}

export function ExhibitorLinkDrawer(props: ExhibitorLinkDrawerProps) {
  if (props.mode === "edit") {
    return (
      <EditExhibitorForm
        key={props.row.id}
        row={props.row}
        onClose={props.onClose}
        onSaved={props.onSaved}
      />
    );
  }
  return (
    <AddExhibitorForm
      editionId={props.editionId}
      attachedCompanyIds={props.attachedCompanyIds}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

type TierFieldsProps = {
  tierLabel: string;
  tierRank: string;
  rankExtraHint?: string;
  onLabelChange: (value: string) => void;
  onRankChange: (value: string) => void;
};

function TierFields({
  tierLabel,
  tierRank,
  rankExtraHint,
  onLabelChange,
  onRankChange,
}: TierFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor="exhibitor-tier-label" className="mb-1 block font-medium text-slate-700">
          Tier label
        </label>
        <input
          id="exhibitor-tier-label"
          className={formInputClass}
          value={tierLabel}
          maxLength={TIER_LABEL_MAX_LENGTH}
          placeholder="e.g. Platinum"
          onChange={(e) => onLabelChange(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">Optional. Leave blank to clear.</p>
      </div>

      <div>
        <label htmlFor="exhibitor-tier-rank" className="mb-1 block font-medium text-slate-700">
          Tier rank *
        </label>
        <input
          id="exhibitor-tier-rank"
          className={formInputClass}
          type="number"
          min={TIER_RANK_MIN}
          max={TIER_RANK_MAX}
          step={1}
          value={tierRank}
          onChange={(e) => onRankChange(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Integer between {TIER_RANK_MIN} and {TIER_RANK_MAX}. Lower ranks appear first.
          {rankExtraHint ? ` ${rankExtraHint}` : ""}
        </p>
      </div>
    </>
  );
}

function EditExhibitorForm({
  row,
  onClose,
  onSaved,
}: {
  row: LiveExhibitorRow;
  onClose: () => void;
  onSaved: (payload: ExhibitorEditSavedPayload) => void;
}) {
  const originalLabel = row.tier_label ?? "";
  const originalRank = row.tier_rank !== null ? String(row.tier_rank) : "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierLabel, setTierLabel] = useState(originalLabel);
  const [tierRank, setTierRank] = useState(originalRank);
  const company = row.companies;

  async function handleSave() {
    setError(null);
    const rank = parseRankInput(tierRank);
    if (rank === null) {
      setError(`Tier rank must be an integer between ${TIER_RANK_MIN} and ${TIER_RANK_MAX}.`);
      return;
    }
    const nextLabel = tierLabel.trim() === "" ? null : tierLabel.trim();
    const labelChanged = nextLabel !== (originalLabel.trim() === "" ? null : originalLabel.trim());
    const rankChanged = rank !== row.tier_rank;
    if (!labelChanged && !rankChanged) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event-exhibitors/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_rank: rank,
          tier_label: nextLabel,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        link?: EventExhibitorLinkAdminRow;
      };
      if (!res.ok || !data.ok || !data.link) {
        setError(data.error ?? "Failed to save changes.");
        setSaving(false);
        return;
      }
      onSaved({ link: data.link, kind: rankChanged ? "tier" : "label" });
    } catch {
      setError("Failed to save changes.");
      setSaving(false);
    }
  }

  return (
    <AdminDrawerShell
      title="Edit exhibitor"
      saving={saving}
      saveLabel="Save"
      onClose={onClose}
      onSave={() => void handleSave()}
    >
      <div>
        <p className="text-sm font-medium text-slate-900">{company?.name ?? "Company"}</p>
        {company ? (
          <Link
            href={`/admin/companies/${company.id}`}
            className="text-sm text-brand-primary hover:underline"
          >
            Open company
          </Link>
        ) : null}
      </div>
      <TierFields
        tierLabel={tierLabel}
        tierRank={tierRank}
        rankExtraHint="Changing the rank moves this exhibitor to the end of the new tier."
        onLabelChange={setTierLabel}
        onRankChange={setTierRank}
      />
      {error ? <InlineErrorBanner message={error} /> : null}
    </AdminDrawerShell>
  );
}

function AddExhibitorForm({
  editionId,
  attachedCompanyIds,
  onClose,
  onSaved,
}: {
  editionId: string;
  attachedCompanyIds: ReadonlySet<string>;
  onClose: () => void;
  onSaved: (payload: ExhibitorCreateSavedPayload) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [lastFetchedTerm, setLastFetchedTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [tierLabel, setTierLabel] = useState("");
  const [tierRank, setTierRank] = useState("1");

  const term = companySearch.trim();
  const searchingCompanies = term.length >= SEARCH_MIN_CHARS && lastFetchedTerm !== term;

  useEffect(() => {
    if (term.length < SEARCH_MIN_CHARS) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/companies?search=${encodeURIComponent(term)}`);
        const data = (await res.json()) as {
          ok: boolean;
          companies?: Array<Record<string, unknown>>;
        };
        if (cancelled) return;
        if (!data.ok || !Array.isArray(data.companies)) {
          setCompanyOptions([]);
          setLastFetchedTerm(term);
          return;
        }
        setCompanyOptions(
          data.companies.map((c) => ({
            id: String(c.id),
            name: typeof c.name === "string" ? c.name : "—",
            domain: typeof c.domain === "string" ? c.domain : null,
            matched_alias:
              typeof c.matched_alias === "string" && c.matched_alias.trim() !== ""
                ? c.matched_alias
                : null,
          })),
        );
        setLastFetchedTerm(term);
      } catch {
        if (!cancelled) {
          setCompanyOptions([]);
          setLastFetchedTerm(term);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  async function handleSave() {
    setError(null);
    if (!selectedCompany) {
      setError("Select a company.");
      return;
    }
    const rank = parseRankInput(tierRank);
    if (rank === null) {
      setError(`Tier rank must be an integer between ${TIER_RANK_MIN} and ${TIER_RANK_MAX}.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event-editions/${editionId}/exhibitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompany.id,
          tier_rank: rank,
          tier_label: tierLabel.trim() === "" ? null : tierLabel.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        link?: EventExhibitorLinkAdminRow;
      };
      if (!res.ok || !data.ok || !data.link) {
        setError(data.error ?? "Failed to add exhibitor.");
        setSaving(false);
        return;
      }
      onSaved({ link: data.link, company: selectedCompany });
    } catch {
      setError("Failed to add exhibitor.");
      setSaving(false);
    }
  }

  return (
    <AdminDrawerShell
      title="Add exhibitor"
      saving={saving}
      saveLabel="Add"
      saveDisabled={!selectedCompany}
      onClose={onClose}
      onSave={() => void handleSave()}
    >
      <div>
        <label htmlFor="exhibitor-company-search" className="mb-1 block font-medium text-slate-700">
          Company
        </label>
        <input
          id="exhibitor-company-search"
          className={formInputClass}
          value={companySearch}
          placeholder="Search by name or domain (min 2 characters)"
          onChange={(e) => {
            setCompanySearch(e.target.value);
            setSelectedCompany(null);
          }}
        />
        <p className="mt-1 text-xs text-slate-500">
          Need a new company?{" "}
          <Link href="/admin/companies/new" className="text-brand-primary hover:underline">
            Create company
          </Link>
        </p>
      </div>

      {term.length >= SEARCH_MIN_CHARS && searchingCompanies ? (
        <p className="text-sm text-slate-500">Searching companies…</p>
      ) : null}

      {term.length >= SEARCH_MIN_CHARS && !searchingCompanies && lastFetchedTerm === term ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {companyOptions.length === 0 ? (
            <li className="px-2 py-1 text-sm text-slate-500">No companies found.</li>
          ) : (
            companyOptions.map((option) => {
              const disabled = attachedCompanyIds.has(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className={[
                      "w-full rounded-md px-2 py-2 text-left text-sm",
                      disabled
                        ? "cursor-not-allowed text-slate-400"
                        : selectedCompany?.id === option.id
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "hover:bg-slate-50",
                    ].join(" ")}
                    onClick={() => setSelectedCompany(option)}
                  >
                    <span className="font-medium">{option.name}</span>
                    {option.domain ? (
                      <span className="ml-2 text-slate-500">{option.domain}</span>
                    ) : null}
                    {disabled ? (
                      <span className="ml-2 text-xs text-slate-400">(already exhibitor)</span>
                    ) : null}
                    <AdminCompanySearchMatchHint matchedAlias={option.matched_alias} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      <TierFields
        tierLabel={tierLabel}
        tierRank={tierRank}
        onLabelChange={setTierLabel}
        onRankChange={setTierRank}
      />
      {error ? <InlineErrorBanner message={error} /> : null}
    </AdminDrawerShell>
  );
}
