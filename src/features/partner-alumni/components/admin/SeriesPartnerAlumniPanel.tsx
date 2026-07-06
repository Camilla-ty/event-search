"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import { Button, InlineErrorBanner } from "@/src/components/common";
import { AdminDrawerShell } from "@/src/features/admin/components/AdminDrawerShell";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import type {
  PartnerAlumniAdminData,
  PartnerAlumniVersionMemberAdminRow,
  PartnerAlumniVersionSummary,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import {
  dateInputToIso,
  mergePartnerAlumniAdminServerRefresh,
  partnerAlumniHeaderFormValues,
  resolvePartnerAlumniHeaderFormSource,
} from "@/src/features/partner-alumni/lib/partnerAlumniAdminPanelState";
import {
  needsPartnerAlumniSetCurrent,
  partnerAlumniSetCurrentPrompt,
} from "@/src/features/partner-alumni/lib/partnerAlumniPublishState";
import { PartnerAlumniBulkUploadDrawer } from "@/src/features/partner-alumni/components/admin/PartnerAlumniBulkUploadDrawer";
import {
  feedbackSuccessClass,
  formInputClass,
  primaryCtaClass,
  secondaryCtaClass,
} from "@/src/lib/design/classes";
import type { PartnerAlumniMoveDirection } from "@/src/lib/validation/partnerAlumni";

const SEARCH_MIN_CHARS = 2;

type PanelAction =
  | { type: "add" }
  | { type: "bulk" }
  | { type: "remove"; member: PartnerAlumniVersionMemberAdminRow }
  | { type: "create-version" }
  | { type: "delete-version" }
  | null;

type SeriesPartnerAlumniPanelProps = {
  seriesId: string;
  initialData: PartnerAlumniAdminData;
  initialLoadError?: string | null;
};

function formatVersionDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function versionListLabel(version: PartnerAlumniVersionSummary): string {
  if (version.version_label && version.version_label.trim() !== "") {
    return version.version_label.trim();
  }
  if (version.recognition_label && version.recognition_label.trim() !== "") {
    return version.recognition_label.trim();
  }
  return `Version · ${formatVersionDate(version.created_at)}`;
}

export function SeriesPartnerAlumniPanel({
  seriesId,
  initialData,
  initialLoadError = null,
}: SeriesPartnerAlumniPanelProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    initialData.selected_version?.id ?? null,
  );
  const [versionLabel, setVersionLabel] = useState(
    () => partnerAlumniHeaderFormValues(initialData.selected_version).versionLabel,
  );
  const [recognitionLabel, setRecognitionLabel] = useState(
    () => partnerAlumniHeaderFormValues(initialData.selected_version).recognitionLabel,
  );
  const [primarySourceUrl, setPrimarySourceUrl] = useState(
    () => partnerAlumniHeaderFormValues(initialData.selected_version).primarySourceUrl,
  );
  const [sourceCheckedAt, setSourceCheckedAt] = useState(
    () => partnerAlumniHeaderFormValues(initialData.selected_version).sourceCheckedAt,
  );
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerSaved, setHeaderSaved] = useState(false);
  const [action, setAction] = useState<PanelAction>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const selectedVersion =
    data.selected_version?.id === selectedVersionId
      ? data.selected_version
      : (data.versions.find((version) => version.id === selectedVersionId) ?? null);

  const members = data.selected_version?.id === selectedVersionId
    ? data.selected_version.members
    : [];

  useEffect(() => {
    setLoadError(initialLoadError ?? null);
  }, [initialLoadError]);

  useEffect(() => {
    setData((prev) => mergePartnerAlumniAdminServerRefresh(prev, initialData, selectedVersionId));
  }, [initialData, selectedVersionId]);

  function syncHeaderFromData(
    nextData: PartnerAlumniAdminData,
    versionId: string | null = selectedVersionId,
  ) {
    const values = partnerAlumniHeaderFormValues(
      resolvePartnerAlumniHeaderFormSource(nextData, versionId),
    );
    setVersionLabel(values.versionLabel);
    setRecognitionLabel(values.recognitionLabel);
    setPrimarySourceUrl(values.primarySourceUrl);
    setSourceCheckedAt(values.sourceCheckedAt);
  }

  function applyResponse(payload: PartnerAlumniAdminData, preferredVersionId?: string | null) {
    const nextSelectedId =
      preferredVersionId ?? payload.selected_version?.id ?? selectedVersionId;
    setData(payload);
    if (nextSelectedId) {
      setSelectedVersionId(nextSelectedId);
      syncHeaderFromData(payload, nextSelectedId);
    }
  }

  function refreshPage() {
    router.refresh();
  }

  const attachedCompanyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const member of members) {
      ids.add(member.company_id);
    }
    return ids;
  }, [members]);

  const memberCount = selectedVersion?.member_count ?? members.length;
  const isCurrent = selectedVersion?.is_current ?? false;
  const canSetCurrent = memberCount >= 1 && !isCurrent;
  const canDeleteVersion = selectedVersion !== null && !isCurrent;
  const setCurrentPrompt = loadError === null ? partnerAlumniSetCurrentPrompt(data) : null;
  const showSetCurrentPublishPrompt =
    setCurrentPrompt !== null && needsPartnerAlumniSetCurrent(data);

  async function handleSelectVersion(versionId: string) {
    if (versionId === selectedVersionId) return;
    setActionError(null);
    setHeaderError(null);
    setHeaderSaved(false);

    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${versionId}`,
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setActionError(json.error ?? "Failed to load version.");
        return;
      }
      applyResponse(json, versionId);
    } catch {
      setActionError("Failed to load version.");
    }
  }

  async function handleSaveHeader() {
    if (selectedVersionId === null) return;
    setHeaderSaving(true);
    setHeaderError(null);
    setHeaderSaved(false);

    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${selectedVersionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version_label: versionLabel.trim() === "" ? null : versionLabel.trim(),
            recognition_label: recognitionLabel.trim() === "" ? null : recognitionLabel.trim(),
            primary_source_url: primarySourceUrl.trim() === "" ? null : primarySourceUrl.trim(),
            source_checked_at: dateInputToIso(sourceCheckedAt),
          }),
        },
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setHeaderError(json.error ?? "Failed to save version header.");
        return;
      }
      applyResponse(json, selectedVersionId);
      setHeaderSaved(true);
    } catch {
      setHeaderError("Failed to save version header.");
    } finally {
      setHeaderSaving(false);
    }
  }

  async function handleSetCurrent() {
    if (selectedVersionId === null || !canSetCurrent) return;
    setLifecycleBusy(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${selectedVersionId}/set-current`,
        { method: "POST" },
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setActionError(json.error ?? "Failed to set current version.");
        return;
      }
      applyResponse(json);
      refreshPage();
    } catch {
      setActionError("Failed to set current version.");
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function handleMove(memberId: string, direction: PartnerAlumniMoveDirection) {
    if (selectedVersionId === null) return;
    setBusyMemberId(memberId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${selectedVersionId}/companies/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: memberId, direction }),
        },
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setActionError(json.error ?? "Failed to reorder roster.");
        return;
      }
      applyResponse(json);
      refreshPage();
    } catch {
      setActionError("Failed to reorder roster.");
    } finally {
      setBusyMemberId(null);
    }
  }

  return (
    <div className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Partner Alumni</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage versioned partner rosters for this series. The{" "}
            <span className="font-medium">current version</span> is shown on public edition pages.
          </p>
        </div>
        <button
          type="button"
          className={primaryCtaClass}
          disabled={loadError !== null}
          onClick={() => setAction({ type: "create-version" })}
        >
          Create New Version
        </button>
      </div>

      {loadError ? (
        <InlineErrorBanner
          message={`Could not load Partner Alumni: ${loadError}. Refresh the page to try again.`}
        />
      ) : null}

      {showSetCurrentPublishPrompt && setCurrentPrompt ? (
        <WarningBanner
          title="Not visible on public edition pages"
          messages={[setCurrentPrompt]}
          action={
            canSetCurrent ? (
              <Button
                type="button"
                variant="secondary"
                disabled={lifecycleBusy}
                onClick={() => void handleSetCurrent()}
              >
                {lifecycleBusy ? "Updating…" : "Set as current"}
              </Button>
            ) : null
          }
        />
      ) : null}

      {data.versions.length === 0 ? (
        <p className="text-sm text-slate-500">
          No versions yet. Create a version to start building a partner roster.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Versions</h3>
            <ul className="mt-2 space-y-1">
              {data.versions.map((version) => {
                const selected = version.id === selectedVersionId;
                return (
                  <li key={version.id}>
                    <button
                      type="button"
                      className={[
                        "w-full rounded-md px-3 py-2 text-left text-sm",
                        selected
                          ? "bg-brand-primary-muted font-medium text-brand-primary"
                          : "text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => void handleSelectVersion(version.id)}
                    >
                      <span className="block truncate">{versionListLabel(version)}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {version.member_count} compan{version.member_count === 1 ? "y" : "ies"}
                        {version.is_current ? " · Current" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selectedVersion ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {versionListLabel(selectedVersion)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created {formatVersionDate(selectedVersion.created_at)}
                    {isCurrent ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                        Current public version
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={secondaryCtaClass}
                    disabled={!canSetCurrent || lifecycleBusy}
                    title={
                      isCurrent
                        ? "Already the current version"
                        : memberCount < 1
                          ? "Add at least one company before setting as current"
                          : "Make this the public version"
                    }
                    onClick={() => void handleSetCurrent()}
                  >
                    {lifecycleBusy ? "Updating…" : "Set as current"}
                  </button>
                  <button
                    type="button"
                    className={secondaryCtaClass}
                    disabled={!canDeleteVersion || lifecycleBusy}
                    title={
                      isCurrent
                        ? "Set another version as current before deleting"
                        : "Delete this version"
                    }
                    onClick={() => setAction({ type: "delete-version" })}
                  >
                    Delete version
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="partner-alumni-version-label"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Version label
                  </label>
                  <input
                    id="partner-alumni-version-label"
                    className={formInputClass}
                    value={versionLabel}
                    maxLength={200}
                    placeholder="e.g. 2026 refresh"
                    onChange={(event) => setVersionLabel(event.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="partner-alumni-source-checked-at"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Source checked date
                  </label>
                  <input
                    id="partner-alumni-source-checked-at"
                    type="date"
                    className={formInputClass}
                    value={sourceCheckedAt}
                    onChange={(event) => setSourceCheckedAt(event.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="partner-alumni-recognition-label"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Recognition label
                  </label>
                  <input
                    id="partner-alumni-recognition-label"
                    className={formInputClass}
                    value={recognitionLabel}
                    maxLength={200}
                    placeholder='e.g. "Our Partners Over The Years"'
                    onChange={(event) => setRecognitionLabel(event.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="partner-alumni-primary-source-url"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Primary source URL
                  </label>
                  <input
                    id="partner-alumni-primary-source-url"
                    className={formInputClass}
                    value={primarySourceUrl}
                    maxLength={2048}
                    placeholder="https://…"
                    onChange={(event) => setPrimarySourceUrl(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={secondaryCtaClass}
                  disabled={headerSaving}
                  onClick={() => void handleSaveHeader()}
                >
                  {headerSaving ? "Saving…" : "Save version header"}
                </button>
                {headerSaved ? (
                  <span className={`${feedbackSuccessClass} !py-2 !text-xs`}>Header saved</span>
                ) : null}
              </div>
              {headerError ? <InlineErrorBanner message={headerError} /> : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Companies ({memberCount})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/events/series/${seriesId}/partner-alumni/versions/${selectedVersionId}/import/new`}
                    className={primaryCtaClass}
                  >
                    Import companies
                  </Link>
                  <button
                    type="button"
                    className={secondaryCtaClass}
                    onClick={() => setAction({ type: "add" })}
                  >
                    Add company
                  </button>
                  <button
                    type="button"
                    className={secondaryCtaClass}
                    onClick={() => setAction({ type: "bulk" })}
                    title="Legacy drawer upload — use Import companies for the new batch workflow"
                  >
                    Bulk upload (legacy)
                  </button>
                </div>
              </div>

              {actionError ? <InlineErrorBanner message={actionError} /> : null}

              {memberCount === 0 ? (
                <p className="text-sm text-slate-500">
                  No companies on this version yet. Add companies from the catalog, then use{" "}
                  <span className="font-medium">Set as current</span> when ready for the public site.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {members.map((member, index) => {
                    const company = member.companies;
                    const isFirst = index === 0;
                    const isLast = index === members.length - 1;
                    const isBusy = busyMemberId === member.id;

                    return (
                      <li
                        key={member.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {company?.name ?? "Unknown company"}
                          </p>
                          {company?.domain ? (
                            <p className="text-sm text-slate-500">{company.domain}</p>
                          ) : null}
                          {company?.id ? (
                            <Link
                              href={`/admin/companies/${company.id}`}
                              className="text-sm text-brand-primary hover:underline"
                            >
                              View company
                            </Link>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="secondary"
                            disabled={isFirst || isBusy}
                            onClick={() => void handleMove(member.id, "up")}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={isLast || isBusy}
                            onClick={() => void handleMove(member.id, "down")}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => setAction({ type: "remove", member })}
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}

      {action?.type === "bulk" && selectedVersionId !== null && selectedVersion ? (
        <PartnerAlumniBulkUploadDrawer
          seriesId={seriesId}
          versionId={selectedVersionId}
          versionLabel={versionListLabel(selectedVersion)}
          onClose={() => setAction(null)}
          onImported={(payload) => {
            applyResponse(payload);
            setAction(null);
            refreshPage();
          }}
        />
      ) : null}

      {action?.type === "add" && selectedVersionId !== null ? (
        <AddPartnerAlumniMemberDrawer
          seriesId={seriesId}
          versionId={selectedVersionId}
          attachedCompanyIds={attachedCompanyIds}
          onClose={() => setAction(null)}
          onAdded={(payload) => {
            applyResponse(payload);
            setAction(null);
            refreshPage();
          }}
        />
      ) : null}

      {action?.type === "remove" && selectedVersionId !== null ? (
        <RemovePartnerAlumniMemberModal
          member={action.member}
          onClose={() => setAction(null)}
          onRemoved={(payload) => {
            applyResponse(payload);
            setAction(null);
            refreshPage();
          }}
          seriesId={seriesId}
          versionId={selectedVersionId}
        />
      ) : null}

      {action?.type === "create-version" ? (
        <CreatePartnerAlumniVersionModal
          seriesId={seriesId}
          hasCurrentVersion={data.program?.current_version_id !== null}
          onClose={() => setAction(null)}
          onCreated={(payload) => {
            applyResponse(payload);
            setAction(null);
            refreshPage();
          }}
        />
      ) : null}

      {action?.type === "delete-version" && selectedVersionId !== null ? (
        <DeletePartnerAlumniVersionModal
          seriesId={seriesId}
          versionId={selectedVersionId}
          versionLabel={selectedVersion ? versionListLabel(selectedVersion) : "this version"}
          onClose={() => setAction(null)}
          onDeleted={(payload) => {
            applyResponse(payload);
            setAction(null);
            refreshPage();
          }}
        />
      ) : null}
    </div>
  );
}

type CompanyOption = {
  id: string;
  name: string;
  domain: string | null;
  matched_alias?: string | null;
};

type AddPartnerAlumniMemberDrawerProps = {
  seriesId: string;
  versionId: string;
  attachedCompanyIds: ReadonlySet<string>;
  onClose: () => void;
  onAdded: (payload: PartnerAlumniAdminData) => void;
};

function AddPartnerAlumniMemberDrawer({
  seriesId,
  versionId,
  attachedCompanyIds,
  onClose,
  onAdded,
}: AddPartnerAlumniMemberDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [lastFetchedTerm, setLastFetchedTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);

  const term = companySearch.trim();

  useEffect(() => {
    if (term.length < SEARCH_MIN_CHARS) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/companies?search=${encodeURIComponent(term)}`);
        const json = (await res.json()) as {
          ok: boolean;
          companies?: Array<Record<string, unknown>>;
        };
        if (cancelled || !json.ok || !Array.isArray(json.companies)) return;
        setCompanyOptions(
          json.companies.map((company) => ({
            id: String(company.id),
            name: typeof company.name === "string" ? company.name : "—",
            domain: typeof company.domain === "string" ? company.domain : null,
            matched_alias:
              typeof company.matched_alias === "string" && company.matched_alias.trim() !== ""
                ? company.matched_alias
                : null,
          })),
        );
        setLastFetchedTerm(term);
      } catch {
        // Ignore transient search failures.
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

  async function handleSave() {
    if (selectedCompany === null) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${versionId}/companies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_id: selectedCompany.id }),
        },
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to add company.");
        setSaving(false);
        return;
      }
      onAdded(json);
    } catch {
      setError("Failed to add company.");
      setSaving(false);
    }
  }

  return (
    <AdminDrawerShell
      title="Add Partner Alumni company"
      saving={saving}
      saveLabel="Add to version"
      saveDisabled={selectedCompany === null}
      onClose={onClose}
      onSave={() => void handleSave()}
    >
      <div>
        <label
          htmlFor="partner-alumni-company-search"
          className="mb-1 block font-medium text-slate-700"
        >
          Company *
        </label>
        <input
          id="partner-alumni-company-search"
          className={formInputClass}
          placeholder="Search companies…"
          value={companySearch}
          onChange={(event) => setCompanySearch(event.target.value)}
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
                      attached ? "cursor-not-allowed text-slate-400" : "hover:bg-slate-50",
                      selected ? "bg-brand-primary-muted" : "",
                    ].join(" ")}
                    onClick={() => setSelectedCompany(option)}
                  >
                    <span className="block">{option.name}</span>
                    <AdminCompanySearchMatchHint
                      matchedAlias={option.matched_alias}
                      className="mt-0.5 block"
                    />
                    {option.domain ? (
                      <span className="ml-2 text-xs text-slate-500">{option.domain}</span>
                    ) : null}
                    {attached ? (
                      <span className="ml-2 text-xs">Already on this version</span>
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
      </div>
      {error ? <InlineErrorBanner message={error} /> : null}
    </AdminDrawerShell>
  );
}

type RemovePartnerAlumniMemberModalProps = {
  seriesId: string;
  versionId: string;
  member: PartnerAlumniVersionMemberAdminRow;
  onClose: () => void;
  onRemoved: (payload: PartnerAlumniAdminData) => void;
};

function RemovePartnerAlumniMemberModal({
  seriesId,
  versionId,
  member,
  onClose,
  onRemoved,
}: RemovePartnerAlumniMemberModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const companyName = member.companies?.name ?? "This company";

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${versionId}/companies/${member.id}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to remove company.");
        setLoading(false);
        return;
      }
      onRemoved(json);
    } catch {
      setError("Failed to remove company.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-slate-900">Remove from version?</h2>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{companyName}</span> will be removed from
          this version&apos;s roster.
        </p>
        {error ? <InlineErrorBanner message={error} className="mt-3" /> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? "Removing…" : "Remove"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type CreatePartnerAlumniVersionModalProps = {
  seriesId: string;
  hasCurrentVersion: boolean;
  onClose: () => void;
  onCreated: (payload: PartnerAlumniAdminData) => void;
};

function CreatePartnerAlumniVersionModal({
  seriesId,
  hasCurrentVersion,
  onClose,
  onCreated,
}: CreatePartnerAlumniVersionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"copy" | "empty">(hasCurrentVersion ? "copy" : "empty");

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const effectiveMode = !hasCurrentVersion && mode === "copy" ? "empty" : mode;
    try {
      const res = await fetch(`/api/admin/event-series/${seriesId}/partner-alumni/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: effectiveMode }),
      });
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to create version.");
        setLoading(false);
        return;
      }
      onCreated(json);
    } catch {
      setError("Failed to create version.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-slate-900">Create New Version</h2>
        <p className="mt-3 text-sm text-slate-600">
          Start a new editable roster version. The new version is not set as current automatically.
        </p>
        <fieldset className="mt-4 space-y-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input
              type="radio"
              name="create-version-mode"
              checked={mode === "copy"}
              disabled={!hasCurrentVersion}
              onChange={() => setMode("copy")}
            />
            <span>
              <span className="font-medium text-slate-900">Copy from current version</span>
              <span className="mt-0.5 block text-slate-600">
                Duplicate header fields and all companies from the current version.
              </span>
              {!hasCurrentVersion ? (
                <span className="mt-1 block text-xs text-slate-500">
                  No current version yet — use start empty instead.
                </span>
              ) : null}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
            <input
              type="radio"
              name="create-version-mode"
              checked={mode === "empty"}
              onChange={() => setMode("empty")}
            />
            <span>
              <span className="font-medium text-slate-900">Start empty</span>
              <span className="mt-0.5 block text-slate-600">
                Create a blank version with no companies.
              </span>
            </span>
          </label>
        </fieldset>
        {error ? <InlineErrorBanner message={error} className="mt-3" /> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleConfirm()} disabled={loading}>
            {loading ? "Creating…" : "Create version"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type DeletePartnerAlumniVersionModalProps = {
  seriesId: string;
  versionId: string;
  versionLabel: string;
  onClose: () => void;
  onDeleted: (payload: PartnerAlumniAdminData) => void;
};

function DeletePartnerAlumniVersionModal({
  seriesId,
  versionId,
  versionLabel,
  onClose,
  onDeleted,
}: DeletePartnerAlumniVersionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/event-series/${seriesId}/partner-alumni/versions/${versionId}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as PartnerAlumniAdminData & {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to delete version.");
        setLoading(false);
        return;
      }
      onDeleted(json);
    } catch {
      setError("Failed to delete version.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-slate-900">Delete version?</h2>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{versionLabel}</span> and all of its
          companies will be permanently deleted. This cannot be undone.
        </p>
        {error ? <InlineErrorBanner message={error} className="mt-3" /> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete version"}
          </Button>
        </div>
      </div>
    </div>
  );
}
