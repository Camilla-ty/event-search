import type { ImportMatchCompany, ImportMatchCompanyDomain } from "@/src/lib/companies/companyImportMatching";
import type { GoldenReferenceInput } from "@/src/lib/companies/importMatchParity/goldenReference";
import type {
  ImportMatchParityDecision,
  ImportMatchParityImporter,
} from "@/src/lib/companies/importMatchParity/types";

const KEEL: ImportMatchCompany = {
  id: "keel-id",
  name: "Keel Infrastructure",
  domain: "keelinfra.com",
  website: "https://keelinfra.com",
  aliases: ["Bitfarms", "Keel Infra"],
};

const OTHER: ImportMatchCompany = {
  id: "other-id",
  name: "Other Corp",
  domain: "other.com",
  website: null,
  aliases: [],
};

const BITLIFI: ImportMatchCompany = {
  id: "bitlifi-id",
  name: "Bitlifi",
  domain: "bitlifi.com",
  website: null,
  aliases: [],
};

const COINGECKO: ImportMatchCompany = {
  id: "coingecko-id",
  name: "CoinGecko",
  domain: "coingecko.com",
  website: "https://www.coingecko.com/",
  aliases: ["CG"],
};

/** Active company that would be "restricted" in product terms — matching still includes it today. */
const RESTRICTED_ACTIVE: ImportMatchCompany = {
  id: "restricted-id",
  name: "Restricted Labs",
  domain: "restrictedlabs.com",
  website: null,
  aliases: [],
};

const DISCORD_COMMUNITY: ImportMatchCompany = {
  id: "galacticpunks-id",
  name: "Galacticpunks",
  domain: null,
  website: "https://discord.com/invite/galactic-punks-881200105817010258",
  aliases: [],
};

/** Canonical Phase 0 directory (active companies only — merged omitted). */
export const PHASE0_ACTIVE_DIRECTORY: {
  companies: ImportMatchCompany[];
  companyDomains: ImportMatchCompanyDomain[];
} = {
  companies: [KEEL, OTHER, BITLIFI, COINGECKO, RESTRICTED_ACTIVE, DISCORD_COMMUNITY],
  companyDomains: [
    { company_id: KEEL.id, domain: "keelinfra.com" },
    { company_id: KEEL.id, domain: "keelinfra.io" },
    { company_id: OTHER.id, domain: "other.com" },
    { company_id: BITLIFI.id, domain: "bitlifi.com" },
    { company_id: BITLIFI.id, domain: "bitlifi.jp" },
    { company_id: COINGECKO.id, domain: "coingecko.com" },
    { company_id: RESTRICTED_ACTIVE.id, domain: "restrictedlabs.com" },
    // Stale domain on a merged tombstone — must not enter candidates (company absent).
    { company_id: "merged-tombstone-id", domain: "aptosnetwork.com" },
  ],
};

export type Phase0ParityFixture = {
  id: string;
  title: string;
  tags: readonly string[];
  input: Omit<GoldenReferenceInput, "fixture_id" | "importer" | "directory">;
  /** Expected golden decisions keyed by importer. */
  expectedByImporter: Partial<
    Record<ImportMatchParityImporter, Omit<ImportMatchParityDecision, "fixture_id" | "importer">>
  >;
};

function persistedFrom(
  partial: Omit<ImportMatchParityDecision, "fixture_id" | "importer" | "persisted">,
): ImportMatchParityDecision["persisted"] {
  return {
    status: partial.status,
    match_method: partial.match_method,
    match_confidence: partial.match_confidence,
    proposed_company_id: partial.proposed_company_id,
    conflict_type: partial.conflict_type,
    intended_link_action: partial.intended_link_action,
    intended_member_action: partial.intended_member_action,
    already_on_live_sponsor_id: partial.already_on_live_sponsor_id,
    already_on_live_exhibitor_id: partial.already_on_live_exhibitor_id,
    already_on_live_tier_rank: partial.already_on_live_tier_rank,
    already_on_version_member_id: partial.already_on_version_member_id,
    duplicate_cluster_key: partial.duplicate_cluster_key,
    duplicate_role: partial.duplicate_role,
    duplicate_of_row_id: partial.duplicate_of_row_id,
    duplicate_resolution: partial.duplicate_resolution,
  };
}

function baseDecision(
  overrides: Partial<Omit<ImportMatchParityDecision, "fixture_id" | "importer" | "persisted">> &
    Pick<ImportMatchParityDecision, "status">,
): Omit<ImportMatchParityDecision, "fixture_id" | "importer"> {
  const partial = {
    proposed_company_id: null as string | null,
    proposed_company_name: null as string | null,
    match_method: null as ImportMatchParityDecision["match_method"],
    match_confidence: null as ImportMatchParityDecision["match_confidence"],
    conflict_type: null as ImportMatchParityDecision["conflict_type"],
    intended_link_action: null as ImportMatchParityDecision["intended_link_action"],
    already_on_live_sponsor_id: null as string | null,
    already_on_live_exhibitor_id: null as string | null,
    already_on_live_tier_rank: null as number | null,
    intended_member_action: null as ImportMatchParityDecision["intended_member_action"],
    already_on_version_member_id: null as string | null,
    create_new_decision: true,
    bulk_preview_status: null as ImportMatchParityDecision["bulk_preview_status"],
    candidate_company_ids: [] as string[],
    candidate_ordering: [] as string[],
    duplicate_in_file: false,
    on_roster: false,
    duplicate_cluster_key: null as string | null,
    duplicate_role: null as ImportMatchParityDecision["duplicate_role"],
    duplicate_of_row_id: null as string | null,
    duplicate_resolution: null as ImportMatchParityDecision["duplicate_resolution"],
    ...overrides,
  };
  return {
    ...partial,
    persisted: persistedFrom(partial),
  };
}

const ALL_ENGINE_IMPORTERS = [
  "sponsor",
  "exhibitor",
  "partner_alumni",
  "partner_alumni_bulk",
] as const satisfies readonly ImportMatchParityImporter[];

function expectAll(
  shared: Partial<Omit<ImportMatchParityDecision, "fixture_id" | "importer" | "persisted">> &
    Pick<ImportMatchParityDecision, "status">,
  perImporter?: Partial<
    Record<
      ImportMatchParityImporter,
      Partial<Omit<ImportMatchParityDecision, "fixture_id" | "importer" | "persisted">>
    >
  >,
): Phase0ParityFixture["expectedByImporter"] {
  const out: Phase0ParityFixture["expectedByImporter"] = {};
  for (const importer of ALL_ENGINE_IMPORTERS) {
    const merged = { ...shared, ...(perImporter?.[importer] ?? {}) };

    if (importer === "partner_alumni_bulk") {
      const bulkStatus =
        merged.bulk_preview_status ??
        (merged.status === "auto_ready"
          ? "matched"
          : merged.proposed_company_id
            ? "review"
            : "create_new");
      out[importer] = baseDecision({
        ...merged,
        status: bulkStatus,
        bulk_preview_status: bulkStatus,
        create_new_decision: bulkStatus === "create_new",
        intended_link_action: null,
        intended_member_action: null,
      });
      continue;
    }

    if (importer === "partner_alumni") {
      out[importer] = baseDecision({
        ...merged,
        create_new_decision: merged.proposed_company_id === null,
        bulk_preview_status: null,
        intended_link_action: null,
        // Production defaults to create_new_link even when no proposed company.
        intended_member_action: merged.intended_member_action ?? "create_new_link",
      });
      continue;
    }

    // sponsor + exhibitor — production defaults to create_new_link unless live overlay overrides.
    out[importer] = baseDecision({
      ...merged,
      create_new_decision: merged.proposed_company_id === null,
      bulk_preview_status: null,
      intended_member_action: null,
      intended_link_action: merged.intended_link_action ?? "create_new_link",
    });
  }
  return out;
}

export const PHASE0_PARITY_FIXTURES: readonly Phase0ParityFixture[] = [
  {
    id: "exact-domain-canonical-name",
    title: "Exact primary domain + canonical name → auto_ready domain",
    tags: ["exact-domain", "canonical-name"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: "domain",
      match_confidence: "high",
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "company-domains-alias-domain",
    title: "Non-primary company_domains row → auto_ready domain",
    tags: ["company_domains", "verified-domains"],
    input: {
      row: {
        normalized_domain: "keelinfra.io",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: "domain",
      match_confidence: "high",
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "verified-domain-plus-alias-name",
    title: "Domain match with alias name → auto_ready alias",
    tags: ["verified-domains", "aliases"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Bitfarms",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: "alias",
      match_confidence: "high",
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "exact-alias-without-domain",
    title: "Exact alias only → needs_review proposal",
    tags: ["aliases"],
    input: {
      row: {
        normalized_domain: null,
        normalized_website: null,
        normalized_company_name: "Keel Infra",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: "alias",
      match_confidence: null,
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "canonical-name-without-domain",
    title: "Exact canonical name only → needs_review exact_name",
    tags: ["canonical-name"],
    input: {
      row: {
        normalized_domain: null,
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: "exact_name",
      match_confidence: null,
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "website-discord-community",
    title: "Hosted platform website key match → auto_ready website",
    tags: ["website-matching", "hosted-platform-domains"],
    input: {
      row: {
        normalized_domain: null,
        normalized_website: "https://discord.com/invite/galactic-punks-881200105817010258",
        normalized_company_name: "Galacticpunks",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: DISCORD_COMMUNITY.id,
      proposed_company_name: DISCORD_COMMUNITY.name,
      match_method: "website",
      match_confidence: "high",
      candidate_company_ids: [DISCORD_COMMUNITY.id],
      candidate_ordering: [DISCORD_COMMUNITY.id],
      create_new_decision: false,
    }),
  },
  {
    id: "bare-coingecko-platform-owner",
    title: "Bare CoinGecko URL + exact name → auto_ready domain",
    tags: ["hosted-platform-domains", "website-matching"],
    input: {
      row: {
        normalized_domain: null,
        normalized_website: "https://www.coingecko.com/",
        normalized_company_name: "CoinGecko",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: COINGECKO.id,
      proposed_company_name: COINGECKO.name,
      match_method: "domain",
      match_confidence: "high",
      // website key + primary domain host both resolve to CoinGecko
      candidate_company_ids: [COINGECKO.id],
      candidate_ordering: [COINGECKO.id],
      create_new_decision: false,
    }),
  },
  {
    id: "multiple-domain-candidates",
    title: "Two active owners of same domain key → multiple_candidates",
    tags: ["multiple-candidates", "exact-domain"],
    input: {
      row: {
        normalized_domain: "shared.jp",
        normalized_website: null,
        normalized_company_name: "Company A",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: null,
      proposed_company_name: null,
      match_method: null,
      conflict_type: "multiple_candidates",
      candidate_company_ids: ["shared-a", "shared-b"],
      candidate_ordering: ["shared-a", "shared-b"],
      create_new_decision: true,
    }),
  },
  {
    id: "merged-tombstone-domain-ignored",
    title: "company_domains on merged tombstone excluded from domain match",
    tags: ["merged-companies", "company_domains"],
    input: {
      row: {
        normalized_domain: "aptosnetwork.com",
        normalized_website: null,
        normalized_company_name: "Aptos",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: null,
      proposed_company_name: null,
      match_method: null,
      candidate_company_ids: [],
      candidate_ordering: [],
      create_new_decision: true,
    }),
  },
  {
    id: "restricted-active-still-matches",
    title: "Restricted-but-active company still matches (current behavior)",
    tags: ["restricted-companies", "exact-domain"],
    input: {
      row: {
        normalized_domain: "restrictedlabs.com",
        normalized_website: null,
        normalized_company_name: "Restricted Labs",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: RESTRICTED_ACTIVE.id,
      proposed_company_name: RESTRICTED_ACTIVE.name,
      match_method: "domain",
      match_confidence: "high",
      candidate_company_ids: [RESTRICTED_ACTIVE.id],
      candidate_ordering: [RESTRICTED_ACTIVE.id],
      create_new_decision: false,
    }),
  },
  {
    id: "domain-name-mismatch",
    title: "Domain hit with unrelated name → domain_name_mismatch",
    tags: ["exact-domain", "duplicate-conflict"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Totally Different Co",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: null,
      conflict_type: "domain_name_mismatch",
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "no-match-create-new",
    title: "No catalog hit → create-new decision",
    tags: ["no-match", "create-new"],
    input: {
      row: {
        normalized_domain: "brand-new-example.com",
        normalized_website: null,
        normalized_company_name: "Brand New Example",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: null,
      proposed_company_name: null,
      match_method: null,
      candidate_company_ids: [],
      candidate_ordering: [],
      create_new_decision: true,
    }),
  },
  {
    id: "live-sponsor-update-tier",
    title: "Existing live sponsor with different tier → update_tier",
    tags: ["existing-live-sponsor"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
        mapped_tier_rank: 2,
      },
      liveSponsorsByCompanyId: new Map([
        [KEEL.id, { id: "live-sponsor-1", tier_rank: 1 }],
      ]),
    },
    expectedByImporter: {
      sponsor: baseDecision({
        status: "auto_ready",
        proposed_company_id: KEEL.id,
        proposed_company_name: KEEL.name,
        match_method: "domain",
        match_confidence: "high",
        intended_link_action: "update_tier",
        already_on_live_sponsor_id: "live-sponsor-1",
        already_on_live_tier_rank: 1,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
    },
  },
  {
    id: "live-sponsor-skip-same-tier",
    title: "Existing live sponsor same tier → skip",
    tags: ["existing-live-sponsor"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
        mapped_tier_rank: 1,
      },
      liveSponsorsByCompanyId: new Map([
        [KEEL.id, { id: "live-sponsor-1", tier_rank: 1 }],
      ]),
    },
    expectedByImporter: {
      sponsor: baseDecision({
        status: "auto_ready",
        proposed_company_id: KEEL.id,
        proposed_company_name: KEEL.name,
        match_method: "domain",
        match_confidence: "high",
        intended_link_action: "skip",
        already_on_live_sponsor_id: "live-sponsor-1",
        already_on_live_tier_rank: 1,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
    },
  },
  {
    id: "live-exhibitor-update-tier",
    title: "Existing live exhibitor different tier → update_tier",
    tags: ["existing-exhibitor"],
    input: {
      row: {
        normalized_domain: "other.com",
        normalized_website: null,
        normalized_company_name: "Other Corp",
        mapped_tier_rank: 3,
      },
      liveExhibitorsByCompanyId: new Map([
        [OTHER.id, { id: "live-exhibitor-1", tier_rank: 1 }],
      ]),
    },
    expectedByImporter: {
      exhibitor: baseDecision({
        status: "auto_ready",
        proposed_company_id: OTHER.id,
        proposed_company_name: OTHER.name,
        match_method: "domain",
        match_confidence: "high",
        intended_link_action: "update_tier",
        already_on_live_exhibitor_id: "live-exhibitor-1",
        already_on_live_tier_rank: 1,
        candidate_company_ids: [OTHER.id],
        candidate_ordering: [OTHER.id],
        create_new_decision: false,
      }),
    },
  },
  {
    id: "pa-member-update-order",
    title: "Existing PA version member different order → update_order",
    tags: ["existing-partner-alumni-member"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
        mapped_display_order: 5,
      },
      versionMembersByCompanyId: new Map([
        [KEEL.id, { id: "pa-member-1", display_order: 2 }],
      ]),
    },
    expectedByImporter: {
      partner_alumni: baseDecision({
        status: "auto_ready",
        proposed_company_id: KEEL.id,
        proposed_company_name: KEEL.name,
        match_method: "domain",
        match_confidence: "high",
        intended_member_action: "update_order",
        already_on_version_member_id: "pa-member-1",
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
    },
  },
  {
    id: "pa-bulk-on-roster",
    title: "PA bulk: matched company already on version → on_roster",
    tags: ["existing-partner-alumni-member", "create-new"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
      on_roster: true,
    },
    expectedByImporter: {
      partner_alumni_bulk: baseDecision({
        status: "on_roster",
        bulk_preview_status: "on_roster",
        proposed_company_id: KEEL.id,
        proposed_company_name: KEEL.name,
        match_method: "domain",
        match_confidence: "high",
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
        on_roster: true,
      }),
    },
  },
  {
    id: "pa-bulk-duplicate-in-file",
    title: "PA bulk: company-id duplicate in file (match fields retained)",
    tags: ["duplicate-conflict", "pa-bulk-company-id-duplicate"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
      duplicate_in_file: true,
      duplicate_in_file_kind: "company_id",
    },
    expectedByImporter: {
      partner_alumni_bulk: baseDecision({
        status: "duplicate_in_file",
        bulk_preview_status: "duplicate_in_file",
        proposed_company_id: KEEL.id,
        proposed_company_name: KEEL.name,
        match_method: "domain",
        match_confidence: "high",
        conflict_type: null,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
        duplicate_in_file: true,
      }),
    },
  },

  // ── Phase 0.1 high-risk edge cases ───────────────────────────────────────
  {
    id: "domain-over-website-precedence",
    title: "Domain present → domain match wins over conflicting website",
    tags: ["domain-over-website", "website-matching", "exact-domain"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website:
          "https://discord.com/invite/galactic-punks-881200105817010258",
        normalized_company_name: "Keel Infrastructure",
      },
    },
    expectedByImporter: expectAll({
      status: "auto_ready",
      proposed_company_id: KEEL.id,
      proposed_company_name: KEEL.name,
      match_method: "domain",
      match_confidence: "high",
      // Website candidates are not consulted when normalized_domain is set.
      candidate_company_ids: [KEEL.id],
      candidate_ordering: [KEEL.id],
      create_new_decision: false,
    }),
  },
  {
    id: "primary-vs-company-domains-disagreement",
    title: "Primary domain owner disagrees with company_domains owner",
    tags: ["primary-vs-company-domains-disagreement", "multiple-candidates", "company_domains"],
    input: {
      row: {
        normalized_domain: "shared.jp",
        normalized_website: null,
        normalized_company_name: "Company A",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: null,
      proposed_company_name: null,
      match_method: null,
      conflict_type: "multiple_candidates",
      candidate_company_ids: ["owner-primary", "owner-alias"],
      candidate_ordering: ["owner-primary", "owner-alias"],
      create_new_decision: true,
    }),
  },
  {
    id: "pa-member-skip-same-order",
    title: "Existing PA member with unchanged display order → skip",
    tags: ["pa-member-skip-same-order", "existing-partner-alumni-member"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
        mapped_display_order: 2,
      },
      versionMembersByCompanyId: new Map([
        [KEEL.id, { id: "pa-member-1", display_order: 2 }],
      ]),
    },
    expectedByImporter: {
      partner_alumni: baseDecision({
        status: "auto_ready",
        proposed_company_id: KEEL.id,
        proposed_company_name: KEEL.name,
        match_method: "domain",
        match_confidence: "high",
        intended_member_action: "skip",
        already_on_version_member_id: "pa-member-1",
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
    },
  },
  {
    id: "pa-bulk-identity-key-duplicate",
    title: "PA bulk: identity-key duplicate clears match fields",
    tags: ["pa-bulk-identity-key-duplicate", "duplicate-conflict"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
      },
      duplicate_in_file_kind: "identity_key",
    },
    expectedByImporter: {
      partner_alumni_bulk: baseDecision({
        status: "duplicate_in_file",
        bulk_preview_status: "duplicate_in_file",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        match_confidence: null,
        conflict_type: null,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
        duplicate_in_file: true,
      }),
    },
  },
  {
    id: "hosted-platform-pollution-link3",
    title: "Polluted link3.to catalog domain does not domain-match other profiles",
    tags: ["hosted-platform-pollution", "hosted-platform-domains", "no-match"],
    input: {
      row: {
        normalized_domain: null,
        normalized_website: "https://link3.to/bar",
        normalized_company_name: "Different Co",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: null,
      proposed_company_name: null,
      match_method: null,
      candidate_company_ids: [],
      candidate_ordering: [],
      create_new_decision: true,
    }),
  },
  {
    id: "hosted-platform-host-only-non-match",
    title: "Bare hosted-platform host URL does not website-match; falls to exact_name",
    tags: ["hosted-platform-host-only", "hosted-platform-domains", "website-matching"],
    input: {
      row: {
        normalized_domain: null,
        normalized_website: "https://link3.to",
        normalized_company_name: "Example Co",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: "link3-example-id",
      proposed_company_name: "Example Co",
      match_method: "exact_name",
      match_confidence: null,
      candidate_company_ids: ["link3-example-id"],
      candidate_ordering: ["link3-example-id"],
      create_new_decision: false,
    }),
  },
  {
    id: "inactive-company-excluded",
    title: "Inactive company owning a domain is excluded from match context",
    tags: ["inactive-companies-excluded", "no-match", "create-new"],
    input: {
      row: {
        normalized_domain: "inactiveco.com",
        normalized_website: null,
        normalized_company_name: "Inactive Co",
      },
    },
    expectedByImporter: expectAll({
      status: "needs_review",
      proposed_company_id: null,
      proposed_company_name: null,
      match_method: null,
      candidate_company_ids: [],
      candidate_ordering: [],
      create_new_decision: true,
    }),
  },
  {
    id: "blocking-validation-short-circuit",
    title: "Blocking validation clears persisted matching fields",
    tags: ["blocking-validation"],
    input: {
      row: {
        normalized_domain: "keelinfra.com",
        normalized_website: null,
        normalized_company_name: "Keel Infrastructure",
        has_blocking_validation: true,
      },
    },
    expectedByImporter: {
      sponsor: baseDecision({
        status: "needs_review",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        match_confidence: null,
        conflict_type: null,
        intended_link_action: null,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
      exhibitor: baseDecision({
        status: "needs_review",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        match_confidence: null,
        conflict_type: null,
        intended_link_action: null,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
      partner_alumni: baseDecision({
        status: "needs_review",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        match_confidence: null,
        conflict_type: null,
        intended_member_action: null,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
      partner_alumni_bulk: baseDecision({
        status: "invalid",
        bulk_preview_status: "invalid",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        match_confidence: null,
        conflict_type: null,
        candidate_company_ids: [KEEL.id],
        candidate_ordering: [KEEL.id],
        create_new_decision: false,
      }),
    },
  },
  {
    id: "sponsor-duplicate-cluster-canonical",
    title: "Sponsor assignDuplicateClusters: highest tier is canonical/kept",
    tags: ["duplicate-cluster-persisted", "duplicate-conflict"],
    input: {
      row: {
        normalized_domain: "google.com",
        normalized_website: null,
        normalized_company_name: "Google",
        mapped_tier_rank: 1,
      },
      cluster_batch: {
        subject_row_id: "row-canonical",
        rows: [
          {
            id: "row-dup",
            excel_row_number: 10,
            normalized_domain: "google.com",
            normalized_website: null,
            normalized_company_name: "Google",
            mapped_tier_rank: 3,
          },
          {
            id: "row-canonical",
            excel_row_number: 11,
            normalized_domain: "google.com",
            normalized_website: null,
            normalized_company_name: "Google",
            mapped_tier_rank: 1,
          },
        ],
      },
    },
    expectedByImporter: {
      sponsor: baseDecision({
        status: "needs_review",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        intended_link_action: "create_new_link",
        candidate_company_ids: [],
        candidate_ordering: [],
        create_new_decision: true,
        duplicate_cluster_key: "domain:google.com",
        duplicate_role: "canonical",
        duplicate_of_row_id: null,
        duplicate_resolution: "kept",
      }),
    },
  },
  {
    id: "exhibitor-duplicate-cluster-sibling",
    title: "Exhibitor assignDuplicateClusters: lower tier is duplicate/excluded",
    tags: ["duplicate-cluster-persisted", "duplicate-conflict"],
    input: {
      row: {
        normalized_domain: "google.com",
        normalized_website: null,
        normalized_company_name: "Google",
        mapped_tier_rank: 3,
      },
      cluster_batch: {
        subject_row_id: "row-dup",
        rows: [
          {
            id: "row-dup",
            excel_row_number: 10,
            normalized_domain: "google.com",
            normalized_website: null,
            normalized_company_name: "Google",
            mapped_tier_rank: 3,
          },
          {
            id: "row-canonical",
            excel_row_number: 11,
            normalized_domain: "google.com",
            normalized_website: null,
            normalized_company_name: "Google",
            mapped_tier_rank: 1,
          },
        ],
      },
    },
    expectedByImporter: {
      exhibitor: baseDecision({
        status: "needs_review",
        proposed_company_id: null,
        proposed_company_name: null,
        match_method: null,
        intended_link_action: "create_new_link",
        candidate_company_ids: [],
        candidate_ordering: [],
        create_new_decision: true,
        duplicate_cluster_key: "domain:google.com",
        duplicate_role: "duplicate",
        duplicate_of_row_id: "row-canonical",
        duplicate_resolution: "excluded",
      }),
    },
  },
];

/** Original Phase 0 fixture ids — must remain present after Phase 0.1. */
export const PHASE0_ORIGINAL_FIXTURE_IDS = [
  "exact-domain-canonical-name",
  "company-domains-alias-domain",
  "verified-domain-plus-alias-name",
  "exact-alias-without-domain",
  "canonical-name-without-domain",
  "website-discord-community",
  "bare-coingecko-platform-owner",
  "multiple-domain-candidates",
  "merged-tombstone-domain-ignored",
  "restricted-active-still-matches",
  "domain-name-mismatch",
  "no-match-create-new",
  "live-sponsor-update-tier",
  "live-sponsor-skip-same-tier",
  "live-exhibitor-update-tier",
  "pa-member-update-order",
  "pa-bulk-on-roster",
  "pa-bulk-duplicate-in-file",
] as const;

/** Directory override for the multiple-candidates fixture only. */
export const PHASE0_SHARED_DOMAIN_DIRECTORY = {
  companies: [
    {
      id: "shared-a",
      name: "Company A",
      domain: "shared.jp",
      website: null,
      aliases: [],
    },
    {
      id: "shared-b",
      name: "Company B",
      domain: null,
      website: null,
      aliases: [],
    },
  ] satisfies ImportMatchCompany[],
  companyDomains: [
    { company_id: "shared-a", domain: "shared.jp" },
    { company_id: "shared-b", domain: "shared.jp" },
  ] satisfies ImportMatchCompanyDomain[],
};

export const PHASE01_PRIMARY_VS_DOMAINS_DIRECTORY = {
  companies: [
    {
      id: "owner-primary",
      name: "Company A",
      domain: "shared.jp",
      website: null,
      aliases: [],
    },
    {
      id: "owner-alias",
      name: "Company B",
      domain: null,
      website: null,
      aliases: [],
    },
  ] satisfies ImportMatchCompany[],
  companyDomains: [{ company_id: "owner-alias", domain: "shared.jp" }] satisfies ImportMatchCompanyDomain[],
};

export const PHASE01_LINK3_POLLUTION_DIRECTORY = {
  companies: [
    {
      id: "polluted-id",
      name: "Polluted Co",
      domain: "link3.to",
      website: "https://link3.to/foo",
      aliases: [],
    },
  ] satisfies ImportMatchCompany[],
  companyDomains: [] as ImportMatchCompanyDomain[],
};

export const PHASE01_LINK3_HOST_ONLY_DIRECTORY = {
  companies: [
    {
      id: "link3-example-id",
      name: "Example Co",
      domain: null,
      website: "https://link3.to/example",
      aliases: [],
    },
  ] satisfies ImportMatchCompany[],
  companyDomains: [] as ImportMatchCompanyDomain[],
};

export const PHASE01_INACTIVE_EXCLUDED_DIRECTORY = {
  companies: [] as ImportMatchCompany[],
  inactiveCompanies: [
    {
      id: "inactive-id",
      name: "Inactive Co",
      domain: "inactiveco.com",
      website: null,
      aliases: [],
    },
  ] satisfies ImportMatchCompany[],
  // Domain row exists in DB but company is inactive → loader omits company → no candidates.
  companyDomains: [
    { company_id: "inactive-id", domain: "inactiveco.com" },
  ] satisfies ImportMatchCompanyDomain[],
};

export function directoryForFixture(fixtureId: string): GoldenReferenceInput["directory"] {
  if (fixtureId === "multiple-domain-candidates") {
    return PHASE0_SHARED_DOMAIN_DIRECTORY;
  }
  if (fixtureId === "primary-vs-company-domains-disagreement") {
    return PHASE01_PRIMARY_VS_DOMAINS_DIRECTORY;
  }
  if (fixtureId === "hosted-platform-pollution-link3") {
    return PHASE01_LINK3_POLLUTION_DIRECTORY;
  }
  if (fixtureId === "hosted-platform-host-only-non-match") {
    return PHASE01_LINK3_HOST_ONLY_DIRECTORY;
  }
  if (fixtureId === "inactive-company-excluded") {
    return PHASE01_INACTIVE_EXCLUDED_DIRECTORY;
  }
  return PHASE0_ACTIVE_DIRECTORY;
}

/** Required coverage tags for Phase 0 reporting. */
export const PHASE0_REQUIRED_TAGS = [
  "exact-domain",
  "company_domains",
  "verified-domains",
  "aliases",
  "canonical-name",
  "website-matching",
  "multiple-candidates",
  "merged-companies",
  "restricted-companies",
  "hosted-platform-domains",
  "no-match",
  "create-new",
  "existing-live-sponsor",
  "existing-exhibitor",
  "existing-partner-alumni-member",
  "duplicate-conflict",
] as const;

/** Additional required coverage tags for Phase 0.1. */
export const PHASE01_REQUIRED_TAGS = [
  "domain-over-website",
  "primary-vs-company-domains-disagreement",
  "pa-member-skip-same-order",
  "pa-bulk-identity-key-duplicate",
  "pa-bulk-company-id-duplicate",
  "hosted-platform-pollution",
  "hosted-platform-host-only",
  "inactive-companies-excluded",
  "restricted-companies",
  "duplicate-cluster-persisted",
  "blocking-validation",
] as const;
