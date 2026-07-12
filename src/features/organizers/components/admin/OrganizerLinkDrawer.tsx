"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InlineErrorBanner } from "@/src/components/common";
import { AdminDrawerShell } from "@/src/features/admin/components/AdminDrawerShell";
import { AdminCompanySearchMatchHint } from "@/src/features/companies/components/admin/AdminCompanySearchMatchHint";
import { formInputClass } from "@/src/lib/design/classes";

import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";
import type { OrganizerLinkMutationRow } from "@/src/features/organizers/client/organizerRosterMutations";

const ROLE_LABEL_MAX_LENGTH = 80;
const SEARCH_MIN_CHARS = 2;

type OrganizerCreateSavedPayload = {
  link: OrganizerLinkMutationRow;
  company: CompanyOption;
};

type OrganizerEditSavedPayload = {
  link: OrganizerLinkMutationRow;
};

type OrganizerLinkDrawerProps =
  | {
      mode: "edit";
      editionId: string;
      row: EditionOrganizerAdminRow;
      onClose: () => void;
      onSaved: (payload: OrganizerEditSavedPayload) => void;
    }
  | {
      mode: "create";
      editionId: string;
      attachedCompanyIds: ReadonlySet<string>;
      onClose: () => void;
      onSaved: (payload: OrganizerCreateSavedPayload) => void;
    };

type CompanyOption = {
  id: string;
  name: string;
  domain: string | null;
  matched_alias?: string | null;
};

export function OrganizerLinkDrawer(props: OrganizerLinkDrawerProps) {
  if (props.mode === "edit") {
    return (
      <EditOrganizerForm
        editionId={props.editionId}
        row={props.row}
        onClose={props.onClose}
        onSaved={props.onSaved}
      />
    );
  }

  return (
    <AddOrganizerForm
      editionId={props.editionId}
      attachedCompanyIds={props.attachedCompanyIds}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

type EditOrganizerFormProps = {
  editionId: string;
  row: EditionOrganizerAdminRow;
  onClose: () => void;
  onSaved: (payload: OrganizerEditSavedPayload) => void;
};

function EditOrganizerForm({ editionId, row, onClose, onSaved }: EditOrganizerFormProps) {
  const originalLabel = row.role_label;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState(originalLabel);
  const company = row.companies;

  async function handleSave() {
    setError(null);
    const trimmed = roleLabel.trim();
    if (trimmed === "") {
      setError("Role label must not be empty.");
      return;
    }
    if (trimmed.length > ROLE_LABEL_MAX_LENGTH) {
      setError(`Role label must be at most ${ROLE_LABEL_MAX_LENGTH} characters.`);
      return;
    }
    if (trimmed === originalLabel.trim()) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/event-editions/${editionId}/organizers/${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role_label: trimmed }),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        link?: OrganizerLinkMutationRow;
      };
      if (!res.ok || !data.ok || !data.link) {
        setError(data.error ?? "Failed to save changes.");
        setSaving(false);
        return;
      }
      onSaved({ link: data.link });
    } catch {
      setError("Failed to save changes.");
      setSaving(false);
    }
  }

  return (
    <AdminDrawerShell
      title="Edit organizer role"
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
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="organizer-role-label" className="mb-1 block font-medium text-slate-700">
          Role label
        </label>
        <input
          id="organizer-role-label"
          className={formInputClass}
          value={roleLabel}
          maxLength={ROLE_LABEL_MAX_LENGTH}
          onChange={(e) => setRoleLabel(e.target.value)}
        />
      </div>

      {error ? <InlineErrorBanner message={error} /> : null}
    </AdminDrawerShell>
  );
}

type AddOrganizerFormProps = {
  editionId: string;
  attachedCompanyIds: ReadonlySet<string>;
  onClose: () => void;
  onSaved: (payload: OrganizerCreateSavedPayload) => void;
};

function AddOrganizerForm({
  editionId,
  attachedCompanyIds,
  onClose,
  onSaved,
}: AddOrganizerFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [lastFetchedTerm, setLastFetchedTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [roleLabel, setRoleLabel] = useState("Organizer");

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
            matched_alias:
              typeof c.matched_alias === "string" && c.matched_alias.trim() !== ""
                ? c.matched_alias
                : null,
          })),
        );
        setLastFetchedTerm(term);
      } catch {
        // Ignore network failures during typing.
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
    const trimmedRole = roleLabel.trim();
    if (trimmedRole === "") {
      setError("Role label must not be empty.");
      return;
    }
    if (trimmedRole.length > ROLE_LABEL_MAX_LENGTH) {
      setError(`Role label must be at most ${ROLE_LABEL_MAX_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event-editions/${editionId}/organizers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompany.id,
          role_label: trimmedRole,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        link?: OrganizerLinkMutationRow;
      };
      if (!res.ok || !data.ok || !data.link) {
        setError(data.error ?? "Failed to add organizer.");
        setSaving(false);
        return;
      }
      onSaved({ link: data.link, company: selectedCompany });
    } catch {
      setError("Failed to add organizer.");
      setSaving(false);
    }
  }

  return (
    <AdminDrawerShell
      title="Add organizer"
      saving={saving}
      saveLabel="Add"
      saveDisabled={!selectedCompany}
      onClose={onClose}
      onSave={() => void handleSave()}
    >
      <div>
        <label htmlFor="organizer-company-search" className="mb-1 block font-medium text-slate-700">
          Company
        </label>
        <input
          id="organizer-company-search"
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

      {term.length >= SEARCH_MIN_CHARS && lastFetchedTerm === term ? (
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
                      <span className="ml-2 text-xs text-slate-400">(already organizer)</span>
                    ) : null}
                    <AdminCompanySearchMatchHint matchedAlias={option.matched_alias} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      <div>
        <label htmlFor="add-organizer-role-label" className="mb-1 block font-medium text-slate-700">
          Role label
        </label>
        <input
          id="add-organizer-role-label"
          className={formInputClass}
          value={roleLabel}
          maxLength={ROLE_LABEL_MAX_LENGTH}
          onChange={(e) => setRoleLabel(e.target.value)}
        />
      </div>

      {error ? <InlineErrorBanner message={error} /> : null}
    </AdminDrawerShell>
  );
}
