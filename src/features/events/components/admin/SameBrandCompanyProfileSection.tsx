"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import type { SameBrandCompanyProfileSummary } from "@/src/features/events/server/eventSeriesAdmin";
import {
  SAME_BRAND_STALE_LINK_MESSAGE,
  isCompanyRestrictedForSameBrand,
  isSameBrandCompanyProfileStale,
} from "@/src/lib/companies/sameBrandCompanyProfile";
import { feedbackWarningClass, formInputClass } from "@/src/lib/design/classes";

const SEARCH_MIN_CHARS = 2;

type CompanySearchOption = {
  id: string;
  name: string;
  domain: string | null;
  restricted_at: string | null;
  matched_alias?: string | null;
};

type SameBrandCompanyProfileSectionProps = {
  seriesId: string;
  seriesLifecycleStatus: string | null;
  initialCompanyProfileId: string | null;
  initialCompanyProfile: SameBrandCompanyProfileSummary | null;
};

type PatchResponse = {
  ok: boolean;
  error?: string;
  warnings?: string[];
  series?: {
    company_profile_id?: string | null;
    company_profile?: SameBrandCompanyProfileSummary | null;
  };
};

export function SameBrandCompanyProfileSection({
  seriesId,
  seriesLifecycleStatus,
  initialCompanyProfileId,
  initialCompanyProfile,
}: SameBrandCompanyProfileSectionProps) {
  const router = useRouter();
  const [linkedCompany, setLinkedCompany] = useState<SameBrandCompanyProfileSummary | null>(
    initialCompanyProfile,
  );
  const [linkedCompanyId, setLinkedCompanyId] = useState<string | null>(initialCompanyProfileId);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanySearchOption[]>([]);
  const [lastFetchedTerm, setLastFetchedTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const term = companySearch.trim();
  const isMergedSeries =
    typeof seriesLifecycleStatus === "string" &&
    seriesLifecycleStatus.trim().toLowerCase() === "merged";
  const stale = linkedCompanyId !== null && isSameBrandCompanyProfileStale(linkedCompany);
  const linkedRestricted = isCompanyRestrictedForSameBrand(linkedCompany);

  useEffect(() => {
    if (term.length < SEARCH_MIN_CHARS) {
      return;
    }

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
            restricted_at: typeof c.restricted_at === "string" ? c.restricted_at : null,
            matched_alias:
              typeof c.matched_alias === "string" && c.matched_alias.trim() !== ""
                ? c.matched_alias
                : null,
          })),
        );
        setLastFetchedTerm(term);
      } catch {
        // Ignore network failures while typing.
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const searchResults =
    term.length >= SEARCH_MIN_CHARS && lastFetchedTerm === term ? companyOptions : null;

  async function persistCompanyProfileId(nextId: string | null, actionLabel: string) {
    setSaving(true);
    setError(null);
    setWarnings([]);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/event-series/${seriesId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_profile_id: nextId }),
      });
      const data = (await res.json()) as PatchResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed to ${actionLabel} same-brand company profile.`);
        setSaving(false);
        return;
      }

      const nextCompany = data.series?.company_profile ?? null;
      const nextCompanyId =
        typeof data.series?.company_profile_id === "string"
          ? data.series.company_profile_id
          : null;
      setLinkedCompany(nextCompany);
      setLinkedCompanyId(nextCompanyId);
      setSelectedCompany(null);
      setCompanySearch("");
      setCompanyOptions([]);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setSuccess(
        nextCompanyId === null
          ? "Same-brand company profile unlinked."
          : "Same-brand company profile saved.",
      );
      setSaving(false);
      router.refresh();
    } catch {
      setError(`Failed to ${actionLabel} same-brand company profile.`);
      setSaving(false);
    }
  }

  function handleLinkOrReplace() {
    if (!selectedCompany) {
      setError("Select a company profile first.");
      return;
    }
    const action = linkedCompanyId ? "replace" : "link";
    void persistCompanyProfileId(selectedCompany.id, action);
  }

  function handleUnlink() {
    if (!window.confirm("Unlink this same-brand company profile from the event series?")) {
      return;
    }
    void persistCompanyProfileId(null, "unlink");
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Same-brand company profile</h2>
      <p className="mt-1 text-sm text-slate-600">
        Optionally link one Company profile that represents the{" "}
        <span className="font-medium text-slate-800">same brand</span> as this Event Series.
        This is not an organizer, owner, or operator relationship — those stay on event editions.
      </p>

      {isMergedSeries ? (
        <p className={`${feedbackWarningClass} mt-4 text-sm`}>
          This event series is merged. Link a same-brand company profile on the successor
          series instead.
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Currently linked
        </p>
        {linkedCompanyId && linkedCompany ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-slate-900">
              <Link
                href={`/admin/companies/${linkedCompany.id}`}
                className="font-medium text-brand-primary hover:underline"
              >
                {linkedCompany.name}
              </Link>
              {linkedCompany.domain ? (
                <span className="ml-2 text-slate-500">{linkedCompany.domain}</span>
              ) : null}
            </p>
            {linkedRestricted ? (
              <p className={`${feedbackWarningClass} text-sm`}>
                This company is restricted from public profiles. The admin link is kept; public
                Event Brand pages will not show it until unrestricted.
              </p>
            ) : null}
            {stale ? (
              <p className={`${feedbackWarningClass} text-sm`}>{SAME_BRAND_STALE_LINK_MESSAGE}</p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={saving || isMergedSeries}
              onClick={handleUnlink}
            >
              Unlink
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No same-brand company profile linked.</p>
        )}
      </div>

      {!isMergedSeries ? (
        <div className="mt-6 space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              {linkedCompanyId ? "Replace with another company" : "Search company profile"}
            </span>
            <input
              type="search"
              className={formInputClass}
              value={companySearch}
              placeholder="Search by name or domain (min 2 characters)"
              disabled={saving}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                setSelectedCompany(null);
                setError(null);
                setSuccess(null);
              }}
            />
          </label>
          <p className="text-xs text-slate-500">
            Need a new company?{" "}
            <Link href="/admin/companies/new" className="text-brand-primary hover:underline">
              Create company
            </Link>
          </p>

          {searchResults !== null ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {searchResults.length === 0 ? (
                <li className="px-2 py-1 text-sm text-slate-500">No companies found.</li>
              ) : (
                searchResults.map((option) => {
                  const isCurrent = option.id === linkedCompanyId;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        disabled={saving || isCurrent}
                        className={[
                          "w-full rounded-md px-2 py-2 text-left text-sm",
                          isCurrent
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
                        {option.restricted_at ? (
                          <span className="ml-2 text-xs text-amber-700">(restricted)</span>
                        ) : null}
                        {isCurrent ? (
                          <span className="ml-2 text-xs text-slate-400">(currently linked)</span>
                        ) : null}
                        <AdminCompanySearchMatchHint matchedAlias={option.matched_alias} />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}

          {selectedCompany && isCompanyRestrictedForSameBrand(selectedCompany) ? (
            <p className={`${feedbackWarningClass} text-sm`}>
              Selected company is restricted. You can still save the same-brand link for admin
              use; it will stay hidden on public Event Brand pages.
            </p>
          ) : null}

          <Button
            type="button"
            disabled={saving || !selectedCompany}
            onClick={handleLinkOrReplace}
          >
            {linkedCompanyId ? "Replace link" : "Link company profile"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <InlineErrorBanner message={error} />
        </div>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning} className={`${feedbackWarningClass} mt-3 text-sm`}>
          {warning}
        </p>
      ))}
      {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}
    </section>
  );
}
