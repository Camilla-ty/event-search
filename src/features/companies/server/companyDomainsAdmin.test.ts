import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  sortCompanyDomainsForDisplay,
  type CompanyDomainAdminRow,
} from "./companyDomainsAdmin";

function row(
  overrides: Partial<CompanyDomainAdminRow> & Pick<CompanyDomainAdminRow, "domain" | "is_primary">,
): CompanyDomainAdminRow {
  return {
    id: overrides.id ?? "00000000-0000-4000-8000-000000000001",
    company_id: overrides.company_id ?? "00000000-0000-4000-8000-000000000099",
    created_at: overrides.created_at ?? null,
    domain: overrides.domain,
    is_primary: overrides.is_primary,
  };
}

describe("sortCompanyDomainsForDisplay", () => {
  it("lists primary domains first, then alphabetically", () => {
    const sorted = sortCompanyDomainsForDisplay([
      row({ id: "1", domain: "bitlifi.jp", is_primary: false }),
      row({ id: "2", domain: "bitlifi.com", is_primary: true }),
      row({ id: "3", domain: "acme.com", is_primary: false }),
    ]);

    assert.deepEqual(
      sorted.map((item) => [item.domain, item.is_primary]),
      [
        ["bitlifi.com", true],
        ["acme.com", false],
        ["bitlifi.jp", false],
      ],
    );
  });
});
