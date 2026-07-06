import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  loadPartnerAlumniImportNewPage,
  type PartnerAlumniImportNewPageLoaders,
} from "./partnerAlumniImportNewPageLoad";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../../..");

const partnerAlumniV1Migration = readFileSync(
  join(repoRoot, "supabase/migrations/20260710120000_partner_alumni_v1.sql"),
  "utf8",
);
const partnerAlumniV2Migration = readFileSync(
  join(repoRoot, "supabase/migrations/20260711120000_partner_alumni_v2_versions.sql"),
  "utf8",
);
const importUiDataSource = readFileSync(join(__dirname, "importUiData.ts"), "utf8");
const partnerAlumniAdminSource = readFileSync(
  join(repoRoot, "src/features/partner-alumni/server/partnerAlumniAdmin.ts"),
  "utf8",
);

describe("Partner Alumni schema contract (PA v1/v2)", () => {
  it("stores event_series_id on event_partner_alumni, not on versions", () => {
    assert.match(partnerAlumniV1Migration, /CREATE TABLE public\.event_partner_alumni[\s\S]*event_series_id uuid NOT NULL/);
    assert.doesNotMatch(partnerAlumniV2Migration, /event_partner_alumni_versions[\s\S]*event_series_id/);
  });

  it("links versions to programs via event_partner_alumni_id", () => {
    assert.match(partnerAlumniV2Migration, /FOREIGN KEY \(event_partner_alumni_id\)/);
    assert.match(partnerAlumniAdminSource, /\.eq\("event_partner_alumni_id", programId\)/);
  });
});

describe("getVersionImportContext regression", () => {
  it("does not filter event_partner_alumni_versions by event_series_id", () => {
    assert.doesNotMatch(importUiDataSource, /\.from\("event_partner_alumni_versions"\)/);
    assert.doesNotMatch(importUiDataSource, /event_partner_alumni_versions[\s\S]*event_series_id/);
    assert.match(importUiDataSource, /assertVersionBelongsToSeries/);
  });
});

describe("loadPartnerAlumniImportNewPage", () => {
  const seriesId = "00000000-0000-0000-0000-000000000001";
  const versionId = "00000000-0000-0000-0000-000000000002";

  it("loads /import/new page data when version context resolves", async () => {
    const loaders: PartnerAlumniImportNewPageLoaders = {
      getVersionImportContext: async () => ({
        seriesId,
        seriesName: "NFT NYC",
        versionId,
        versionLabel: "2026 roster",
        isCurrent: false,
        memberCount: 12,
        warnings: [],
      }),
      getActiveBatchForVersion: async () => null,
    };

    const result = await loadPartnerAlumniImportNewPage({ seriesId, versionId }, loaders);

    assert.ok(result);
    assert.equal(result.versionContext.seriesName, "NFT NYC");
    assert.equal(result.versionContext.versionLabel, "2026 roster");
    assert.equal(result.activeBatchId, null);
  });

  it("returns null when the version is not in scope for the series", async () => {
    const loaders: PartnerAlumniImportNewPageLoaders = {
      getVersionImportContext: async () => null,
      getActiveBatchForVersion: async () => {
        throw new Error("should not query batches when version context is missing");
      },
    };

    const result = await loadPartnerAlumniImportNewPage({ seriesId, versionId }, loaders);
    assert.equal(result, null);
  });

  it("surfaces an active batch id when one exists", async () => {
    const loaders: PartnerAlumniImportNewPageLoaders = {
      getVersionImportContext: async () => ({
        seriesId,
        seriesName: "NFT NYC",
        versionId,
        versionLabel: "Draft import",
        isCurrent: true,
        memberCount: 0,
        warnings: ["This is the current public version."],
      }),
      getActiveBatchForVersion: async () => ({ id: "batch-123" }),
    };

    const result = await loadPartnerAlumniImportNewPage({ seriesId, versionId }, loaders);

    assert.ok(result);
    assert.equal(result.activeBatchId, "batch-123");
    assert.equal(result.versionContext.warnings.length, 1);
  });
});
