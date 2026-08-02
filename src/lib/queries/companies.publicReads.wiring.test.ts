import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const sourcePath = join(process.cwd(), "src/lib/queries/companies.ts");

/**
 * ARC-001 Phase 1 wiring: public profile + sponsor-link hydration must not
 * call createAdminClient.
 */
describe("companies public reads wiring (ARC-001 Phase 1)", () => {
  const source = readFileSync(sourcePath, "utf8");

  function sliceExport(marker: string): string {
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `expected ${marker}`);
    const nextExport = source.indexOf("\nexport ", start + 1);
    const nextAsync = source.indexOf("\nasync function ", start + 1);
    const candidates = [nextExport, nextAsync].filter((i) => i > start);
    const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
    return source.slice(start, end);
  }

  it("getCompanyById fails closed without admin fallback", () => {
    const body = sliceExport("export async function getCompanyById");
    assert.match(body, /createClient/);
    assert.match(body, /\.is\("restricted_at", null\)/);
    assert.match(body, /resolvePublicCompanyProfileQueryResult/);
    assert.doesNotMatch(body, /createAdminClient/);
    assert.doesNotMatch(body, /getCompanyByIdAdmin/);
  });

  it("getCompanyBySlug fails closed without admin fallback", () => {
    const body = sliceExport("export async function getCompanyBySlug");
    assert.match(body, /createClient/);
    assert.match(body, /\.is\("restricted_at", null\)/);
    assert.match(body, /resolvePublicCompanyProfileQueryResult/);
    assert.doesNotMatch(body, /createAdminClient/);
    assert.doesNotMatch(body, /getCompanyBySlugAdmin/);
  });

  it("getCompaniesByIds uses session client and fails closed without admin", () => {
    const body = sliceExport("export async function getCompaniesByIds");
    assert.match(body, /createClient/);
    assert.match(body, /catch/);
    assert.doesNotMatch(body, /createAdminClient/);
    assert.doesNotMatch(body, /getCompaniesByIdsAdmin/);
  });

  it("mergeCompaniesOntoEventSponsorLinks does not admin-fill missing companies", () => {
    const body = sliceExport("export async function mergeCompaniesOntoEventSponsorLinks");
    assert.match(body, /getCompaniesByIds/);
    assert.match(body, /attachCompaniesToEventSponsorLinks/);
    assert.doesNotMatch(body, /createAdminClient/);
    assert.doesNotMatch(body, /getCompaniesByIdsAdmin/);
    assert.doesNotMatch(body, /missingCompanyIds/);
  });

  it("removed Phase 1 admin helper symbols from the module", () => {
    assert.doesNotMatch(source, /function getCompanyByIdAdmin/);
    assert.doesNotMatch(source, /function getCompanyBySlugAdmin/);
    assert.doesNotMatch(source, /function getCompaniesByIdsAdmin/);
  });

  it("fails if createAdminClient is reintroduced into Phase 1 public helpers", () => {
    for (const marker of [
      "export async function getCompanyById",
      "export async function getCompanyBySlug",
      "export async function getCompaniesByIds",
      "export async function mergeCompaniesOntoEventSponsorLinks",
      "export function resolvePublicCompanyProfileQueryResult",
      "export function attachCompaniesToEventSponsorLinks",
    ]) {
      assert.doesNotMatch(sliceExport(marker), /createAdminClient/);
    }
  });
});
