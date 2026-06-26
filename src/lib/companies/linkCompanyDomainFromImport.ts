import type { SupabaseClient } from "@supabase/supabase-js";

export class CompanyDomainLinkError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CompanyDomainLinkError";
    this.status = status;
  }
}

export type CompanyDomainLinkPlan =
  | { action: "skip"; reason: "no_domain" | "same_as_primary" }
  | { action: "noop"; reason: "already_linked" }
  | { action: "insert"; domain: string; companyId: string }
  | { action: "conflict"; domain: string; ownerCompanyId: string };

export function normalizeLinkDomain(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "" ? null : normalized;
}

export function planCompanyDomainLink(input: {
  normalizedImportDomain: string | null;
  companyPrimaryDomain: string | null;
  targetCompanyId: string;
  existingCompanyDomainOwners: ReadonlyArray<{ company_id: string; domain: string }>;
  otherCompanyPrimaryDomainOwners: ReadonlyArray<{ id: string; domain: string }>;
}): CompanyDomainLinkPlan {
  const domain = normalizeLinkDomain(input.normalizedImportDomain);
  if (!domain) {
    return { action: "skip", reason: "no_domain" };
  }

  const primaryDomain = normalizeLinkDomain(input.companyPrimaryDomain);
  if (primaryDomain === domain) {
    return { action: "skip", reason: "same_as_primary" };
  }

  for (const owner of input.otherCompanyPrimaryDomainOwners) {
    if (normalizeLinkDomain(owner.domain) === domain) {
      return { action: "conflict", domain, ownerCompanyId: owner.id };
    }
  }

  for (const row of input.existingCompanyDomainOwners) {
    if (normalizeLinkDomain(row.domain) !== domain) continue;
    if (row.company_id === input.targetCompanyId) {
      return { action: "noop", reason: "already_linked" };
    }
    return { action: "conflict", domain, ownerCompanyId: row.company_id };
  }

  return {
    action: "insert",
    domain,
    companyId: input.targetCompanyId,
  };
}

export async function ensureCompanyDomainFromImportLink(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    normalizedImportDomain: string | null;
  },
): Promise<CompanyDomainLinkPlan> {
  const domain = normalizeLinkDomain(params.normalizedImportDomain);
  if (!domain) {
    return { action: "skip", reason: "no_domain" };
  }

  const [{ data: company, error: companyError }, { data: domainRows, error: domainsError }, { data: primaryOwners, error: primaryError }] =
    await Promise.all([
      supabase.from("companies").select("domain").eq("id", params.companyId).maybeSingle(),
      supabase.from("company_domains").select("company_id, domain").eq("domain", domain),
      supabase.from("companies").select("id, domain").eq("domain", domain).neq("id", params.companyId),
    ]);

  if (companyError) throw new Error(companyError.message);
  if (domainsError) throw new Error(domainsError.message);
  if (primaryError) throw new Error(primaryError.message);
  if (!company) {
    throw new CompanyDomainLinkError(404, "Company not found.");
  }

  const plan = planCompanyDomainLink({
    normalizedImportDomain: domain,
    companyPrimaryDomain: typeof company.domain === "string" ? company.domain : null,
    targetCompanyId: params.companyId,
    existingCompanyDomainOwners: (domainRows ?? []).map((row) => ({
      company_id: String(row.company_id),
      domain: String(row.domain),
    })),
    otherCompanyPrimaryDomainOwners: (primaryOwners ?? []).map((row) => ({
      id: String(row.id),
      domain: String(row.domain),
    })),
  });

  if (plan.action === "insert") {
    const { error: insertError } = await supabase.from("company_domains").insert({
      company_id: plan.companyId,
      domain: plan.domain,
      is_primary: false,
    });

    if (insertError) {
      if (
        insertError.message.includes("company_domains_domain_uidx") ||
        insertError.message.includes("duplicate key")
      ) {
        const { data: racedOwners, error: racedError } = await supabase
          .from("company_domains")
          .select("company_id, domain")
          .eq("domain", plan.domain);
        if (racedError) throw new Error(racedError.message);

        const racedPlan = planCompanyDomainLink({
          normalizedImportDomain: plan.domain,
          companyPrimaryDomain: typeof company.domain === "string" ? company.domain : null,
          targetCompanyId: params.companyId,
          existingCompanyDomainOwners: (racedOwners ?? []).map((row) => ({
            company_id: String(row.company_id),
            domain: String(row.domain),
          })),
          otherCompanyPrimaryDomainOwners: (primaryOwners ?? []).map((row) => ({
            id: String(row.id),
            domain: String(row.domain),
          })),
        });

        if (racedPlan.action === "conflict") {
          throw new CompanyDomainLinkError(
            409,
            "This domain is already linked to another company.",
          );
        }
        return racedPlan.action === "noop" ? racedPlan : { action: "noop", reason: "already_linked" };
      }
      throw new Error(insertError.message);
    }
  }

  if (plan.action === "conflict") {
    throw new CompanyDomainLinkError(409, "This domain is already linked to another company.");
  }

  return plan;
}
