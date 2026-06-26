"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import type { CompanyDomainAdminRow } from "@/src/features/companies/server/companyDomainsAdmin";
import { feedbackSuccessClass, formInputClass } from "@/src/lib/design/classes";

type CompanyDomainsSectionProps = {
  companyId: string;
  domains: CompanyDomainAdminRow[];
  canAdd: boolean;
};

type AddDomainApiResponse = {
  ok: boolean;
  error?: string;
  result?: {
    status: "created" | "already_linked" | "same_as_primary";
    domain: string;
    message?: string;
  };
  domains?: CompanyDomainAdminRow[];
};

export function CompanyDomainsSection({
  companyId,
  domains,
  canAdd,
}: CompanyDomainsSectionProps) {
  const router = useRouter();
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!canAdd && domains.length === 0) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdd || loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/companies/${companyId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      const data = (await response.json()) as AddDomainApiResponse;

      if (!data.ok) {
        setError(data.error ?? "Could not add domain.");
        return;
      }

      if (data.result?.status === "created") {
        setNotice(`Added ${data.result.domain}.`);
        setDomainInput("");
      } else {
        setNotice(data.result?.message ?? "Domain is already linked.");
      }

      router.refresh();
    } catch {
      setError("Could not add domain.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Company Domains</h2>
      <p className="mb-3 text-sm text-slate-500">
        Internal identity data for matching. Not shown on public company profiles.
      </p>

      {domains.length > 0 ? (
        <ul className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
          {domains.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
              <span className="font-medium">{row.domain}</span>
              <span className="text-slate-500">{row.is_primary ? "Primary" : "Additional"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-slate-500">No additional domains stored yet.</p>
      )}

      {canAdd ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-medium text-slate-800" htmlFor="company-domain-input">
            Add domain
          </label>
          <input
            id="company-domain-input"
            className={formInputClass}
            placeholder="bitlifi.jp or https://bitlifi.jp"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-slate-500">
            Stores an additional verified domain for import matching. Does not change the public
            website.
          </p>
          <Button type="submit" size="sm" disabled={loading || domainInput.trim() === ""}>
            {loading ? "Adding…" : "Add domain"}
          </Button>
          {notice ? <p className={`${feedbackSuccessClass} text-sm`}>{notice}</p> : null}
          {error ? <InlineErrorBanner message={error} /> : null}
        </form>
      ) : null}
    </div>
  );
}
