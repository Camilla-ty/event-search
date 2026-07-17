import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyDomainSyncRow = {
  id: string;
  domain: string;
  is_primary: boolean;
};

export type SyncCompanyPrimaryDomainPlan =
  | { action: "noop" }
  | { action: "demote_all_primary" }
  | { action: "promote_existing"; domainRowId: string }
  | { action: "insert_primary"; domain: string }
  | { action: "demote_then_insert"; domain: string }
  | { action: "conflict"; domain: string };

function normalizeDomainKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "" ? null : normalized;
}

/**
 * Plan how to keep primary `company_domains` in sync with `companies.domain`.
 * Does not widen import matching; only maintains the primary-row invariant.
 */
export function planSyncCompanyPrimaryDomain(input: {
  desiredDomain: string | null;
  companyDomainRows: readonly CompanyDomainSyncRow[];
  /** Other companies that already own `desiredDomain` in company_domains. */
  foreignOwnersOfDesiredDomain: readonly { company_id: string }[];
}): SyncCompanyPrimaryDomainPlan {
  const desired = normalizeDomainKey(input.desiredDomain);

  if (!desired) {
    return input.companyDomainRows.some((row) => row.is_primary)
      ? { action: "demote_all_primary" }
      : { action: "noop" };
  }

  if (input.foreignOwnersOfDesiredDomain.length > 0) {
    return { action: "conflict", domain: desired };
  }

  const matching = input.companyDomainRows.find(
    (row) => normalizeDomainKey(row.domain) === desired,
  );
  if (matching?.is_primary) {
    return { action: "noop" };
  }
  if (matching && !matching.is_primary) {
    return { action: "promote_existing", domainRowId: matching.id };
  }

  const hasPrimary = input.companyDomainRows.some((row) => row.is_primary);
  return hasPrimary
    ? { action: "demote_then_insert", domain: desired }
    : { action: "insert_primary", domain: desired };
}

async function demoteAllPrimary(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from("company_domains")
    .update({ is_primary: false })
    .eq("company_id", companyId)
    .eq("is_primary", true);
  if (error) throw new Error(error.message);
}

async function promoteExisting(
  supabase: SupabaseClient,
  companyId: string,
  domainRowId: string,
): Promise<void> {
  await demoteAllPrimary(supabase, companyId);
  const { error } = await supabase
    .from("company_domains")
    .update({ is_primary: true })
    .eq("id", domainRowId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

async function insertPrimary(
  supabase: SupabaseClient,
  companyId: string,
  domain: string,
): Promise<void> {
  const { error } = await supabase.from("company_domains").insert({
    company_id: companyId,
    domain,
    is_primary: true,
  });
  if (error) throw new Error(error.message);
}

/**
 * Synchronize the company's primary `company_domains` row with `desiredDomain`
 * (typically the post-save `companies.domain` value).
 */
export async function syncCompanyPrimaryDomainWithClient(
  supabase: SupabaseClient,
  companyId: string,
  desiredDomain: string | null,
): Promise<void> {
  const desired = normalizeDomainKey(desiredDomain);

  const { data: rows, error: rowsError } = await supabase
    .from("company_domains")
    .select("id, domain, is_primary")
    .eq("company_id", companyId);
  if (rowsError) throw new Error(rowsError.message);

  const companyDomainRows: CompanyDomainSyncRow[] = (rows ?? []).map((row) => ({
    id: String(row.id),
    domain: String(row.domain),
    is_primary: row.is_primary === true,
  }));

  let foreignOwners: { company_id: string }[] = [];
  if (desired) {
    const { data: owners, error: ownersError } = await supabase
      .from("company_domains")
      .select("company_id")
      .eq("domain", desired)
      .neq("company_id", companyId);
    if (ownersError) throw new Error(ownersError.message);
    foreignOwners = (owners ?? []).map((row) => ({
      company_id: String(row.company_id),
    }));
  }

  const plan = planSyncCompanyPrimaryDomain({
    desiredDomain: desired,
    companyDomainRows,
    foreignOwnersOfDesiredDomain: foreignOwners,
  });

  switch (plan.action) {
    case "noop":
      return;
    case "demote_all_primary":
      await demoteAllPrimary(supabase, companyId);
      return;
    case "promote_existing":
      await promoteExisting(supabase, companyId, plan.domainRowId);
      return;
    case "insert_primary":
      await insertPrimary(supabase, companyId, plan.domain);
      return;
    case "demote_then_insert":
      await demoteAllPrimary(supabase, companyId);
      await insertPrimary(supabase, companyId, plan.domain);
      return;
    case "conflict":
      throw new Error(
        `Cannot sync primary domain "${plan.domain}": already linked to another company.`,
      );
  }
}
