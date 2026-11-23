import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Supabase-bound Review mutations are not unit-testable without a database, so these
 * checks pin the server-side matching guard (and claim-token queries) in the source.
 */
const source = readFileSync(
  join(process.cwd(), "src/features/sponsor-import/server/sponsorImportAdmin.ts"),
  "utf8",
);

function functionBody(signature: string): string {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `Expected to find ${signature}`);
  const next = source.indexOf("\nexport async function ", start + signature.length);
  const nextPrivate = source.indexOf("\nasync function ", start + signature.length);
  const ends = [next, nextPrivate].filter((index) => index > start);
  return source.slice(start, ends.length > 0 ? Math.min(...ends) : undefined);
}

describe("Review mutations reject requests while a workflow holds the batch", () => {
  const writes = [".update(", ".delete(", ".insert(", "ensureCompanyDomainFromImportLink", "maybeLinkReviewedImportDomain"];

  for (const signature of ["export async function saveColumnMapping(", "export async function runBatchValidation("]) {
    it(`${signature.replace("export async function ", "").replace("(", "")} calls assertNotMatching before any write`, () => {
      const body = functionBody(signature);
      assert.match(body, /assertBatchStatus\(batch, \["uploaded", "review"\]\);\s*assertNotMatching\(batch\);/);
      const guardAt = body.indexOf("assertNotMatching(batch)");
      for (const write of writes) {
        const writeAt = body.indexOf(write);
        if (writeAt >= 0) {
          assert.ok(guardAt < writeAt, `assertNotMatching must precede ${write}`);
        }
      }
    });
  }

  for (const signature of [
    "export async function bulkAcceptDomainMatches(",
    "export async function bulkApplyRowDecisions(",
    "export async function patchRowDecision(",
  ]) {
    it(`${signature.replace("export async function ", "").replace("(", "")} prepares the batch before any read or write`, () => {
      const body = functionBody(signature);
      const prepareAt = body.indexOf("await prepareReviewMutation(batchId);");
      assert.ok(prepareAt >= 0, "expected await prepareReviewMutation(batchId)");
      for (const step of [...writes, "createAdminClient()", "WithDeps("]) {
        const stepAt = body.indexOf(step);
        if (stepAt >= 0) {
          assert.ok(prepareAt < stepAt, `prepareReviewMutation must precede ${step}`);
        }
      }
    });
  }

  it("Review mutations recover only through the stale import recovery, then apply the phase guard", () => {
    const body = functionBody("function prepareReviewMutation(");
    assert.match(body, /readBatch: \(\) => getBatchRow\(batchId\)/);
    assert.match(body, /recoverStaleImportClaim: \(batch\) => recoverStaleImportProcessingPhase\(batchId, batch\)/);
  });

  it("stale import recovery clears only the exact claim that was judged stale", () => {
    const body = functionBody("async function recoverStaleImportProcessingPhase(");
    const clear = body.slice(body.indexOf("clearStaleClaim: async (phase, staleUpdatedAt)"), body.indexOf("now: () =>"));
    assert.match(
      clear,
      /\.update\(\{ processing_phase: null, updated_at: [^}]+\}\)\s*\.eq\("id", batchId\)\s*\.eq\("status", "review"\)\s*\.eq\("processing_phase", phase\);/,
    );
    assert.match(
      clear,
      /staleUpdatedAt === null \? query\.is\("updated_at", null\) : query\.eq\("updated_at", staleUpdatedAt\)/,
    );
  });

  it("validation writes a row only while it still has the status validation read", () => {
    const body = functionBody("export async function runBatchValidation(");
    const update = body.slice(
      body.indexOf("updateRowIfStatusUnchanged: async (rowId, readStatus, patch)"),
      body.indexOf("finishValidation:"),
    );
    assert.match(
      update,
      /\.update\(patch\)\s*\.eq\("id", rowId\)\s*\.eq\("batch_id", batchId\)\s*\.eq\("status", readStatus\)\s*\.select\("id"\);/,
    );
    assert.match(update, /return \(data \?\? \[\]\)\.length > 0;/);
  });

  it("validation claims only an uploaded/review batch that is idle or held by an earlier validation", () => {
    const body = functionBody("export async function runBatchValidation(");
    assert.match(
      body,
      /\.update\(\{ processing_phase: "validating", updated_at: token \}\)\s*\.eq\("id", batchId\)\s*\.in\("status", \["uploaded", "review"\]\)\s*\.or\("processing_phase\.is\.null,processing_phase\.eq\.validating"\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
  });

  it("validation clears the phase only while its own token still holds the claim", () => {
    const body = functionBody("export async function runBatchValidation(");
    const finish = body.slice(body.indexOf("finishValidation: async (token)"), body.indexOf("releaseValidatingClaim:"));
    assert.match(
      finish,
      /\.update\(\{ status: "review", processing_phase: null, updated_at: [^}]+\}\)\s*\.eq\("id", batchId\)\s*\.in\("status", \["uploaded", "review"\]\)\s*\.eq\("processing_phase", "validating"\)\s*\.eq\("updated_at", token\)/,
    );
    assert.match(finish, /return Boolean\(released\);/);
    assert.equal(
      (finish.match(/\.update\(/g) ?? []).length,
      1,
      "finishing must write only through the token-filtered update",
    );
    const release = body.slice(body.indexOf("releaseValidatingClaim: async (token)"), body.indexOf("logValidationRun:"));
    assert.match(
      release,
      /\.update\(\{ processing_phase: null, updated_at: [^}]+\}\)\s*\.eq\("id", batchId\)\s*\.eq\("processing_phase", "validating"\)\s*\.eq\("updated_at", token\);/,
    );
  });

  it("import-to-draft finalisation is blocked while matching", () => {
    const guard = functionBody("function assertImportToDraftNotBlockedByProcessingPhase(");
    assert.match(guard, /assertNotMatching\(batch\);/);
    const body = functionBody("async function executeImportBatchToDraft(");
    assert.ok(
      body.indexOf("assertImportToDraftNotBlockedByProcessingPhase(batch)") <
        body.indexOf('status: "draft"'),
    );
  });

  it("import-to-draft finalisation only updates an idle review batch", () => {
    const body = functionBody("async function executeImportBatchToDraft(");
    assert.match(
      body,
      /status: "draft",[\s\S]*?\.eq\("id", batchId\)\s*\.eq\("status", "review"\)\s*(\/\/[^\n]*\s*)?\.is\("processing_phase", null\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
  });
});

describe("column mapping parsing claim queries", () => {
  function depBody(dep: string): string {
    const body = functionBody("export async function saveColumnMapping(");
    const start = body.indexOf(dep);
    assert.ok(start >= 0, `Expected ${dep} in saveColumnMapping`);
    return body.slice(start, body.indexOf("\n    },", start));
  }

  it("delegates to saveColumnMappingWithDeps", () => {
    assert.match(functionBody("export async function saveColumnMapping("), /return saveColumnMappingWithDeps\(\{/);
  });

  it("claims parsing only when no workflow holds the batch", () => {
    assert.match(
      depBody("claimParsingPhase: async ()"),
      /\.update\(\{ processing_phase: "parsing", updated_at: token \}\)\s*\.eq\("id", batchId\)\s*\.in\("status", \["uploaded", "review"\]\)\s*\.is\("processing_phase", null\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
  });

  it("takes over a stale claim only while it still holds the observed phase and token", () => {
    assert.match(
      depBody("takeOverStaleClaim: async (phase, staleToken)"),
      /\.update\(\{ processing_phase: "parsing", updated_at: token \}\)\s*\.eq\("id", batchId\)\s*\.in\("status", \["uploaded", "review"\]\)\s*\.eq\("processing_phase", phase\)\s*\.eq\("updated_at", staleToken\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
  });

  it("releases only while the caller's token still holds the parsing claim", () => {
    assert.match(
      depBody("saveMappingAndReleaseClaim: async (token"),
      /processing_phase: null,\s*updated_at: [^}]+\}\)\s*\.eq\("id", batchId\)\s*\.eq\("processing_phase", "parsing"\)\s*\.eq\("updated_at", token\)/,
    );
    assert.match(
      depBody("releaseParsingClaim: async (token)"),
      /\.update\(\{ processing_phase: null, updated_at: [^}]+\}\)\s*\.eq\("id", batchId\)\s*\.eq\("processing_phase", "parsing"\)\s*\.eq\("updated_at", token\);/,
    );
  });

  it("saving the mapping writes only through the token-filtered update, with no fallback", () => {
    const body = depBody("saveMappingAndReleaseClaim: async (token");
    assert.equal(
      (body.match(/\.update\(/g) ?? []).length,
      1,
      "a save that lost its claim must not write the mapping or status",
    );
    assert.match(body, /return released \?\? null;/);
  });

  it("checks the row delete error", () => {
    assert.match(depBody("deleteRows: async ()"), /if \(error\) throw new Error\(error\.message\);/);
  });
});

describe("import chunk claim queries", () => {
  function depBody(dep: string): string {
    const body = functionBody("function acquireImportChunkClaim(");
    const start = body.indexOf(dep);
    assert.ok(start >= 0, `Expected ${dep} in acquireImportChunkClaim`);
    return body.slice(start, body.indexOf("\n    },", start));
  }

  it("claims only an idle review batch, and returns the new token only when a row matched", () => {
    const body = depBody("claimFromIdle: async ()");
    assert.match(
      body,
      /\.update\(\{ processing_phase: phase, updated_at: token \}\)\s*\.eq\("id", batchId\)\s*\.eq\("status", "review"\)\s*\.is\("processing_phase", null\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
    assert.match(body, /return data \? token : null;/);
  });

  it("continues a claim only for the request presenting its current token", () => {
    const body = depBody("continueClaim: async (heldToken)");
    assert.match(
      body,
      /\.update\(\{ updated_at: token \}\)\s*\.eq\("id", batchId\)\s*\.eq\("status", "review"\)\s*\.eq\("processing_phase", phase\)\s*\.eq\("updated_at", heldToken\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
    assert.match(body, /return data \? token : null;/);
  });

  it("takes over an abandoned claim only while it still has the updated_at judged abandoned", () => {
    const body = depBody("takeOverClaim: async (abandonedUpdatedAt)");
    assert.match(
      body,
      /\.update\(\{ updated_at: token \}\)\s*\.eq\("id", batchId\)\s*\.eq\("status", "review"\)\s*\.eq\("processing_phase", phase\);/,
    );
    assert.match(
      body,
      /abandonedUpdatedAt === null\s*\? query\.is\("updated_at", null\)\s*: query\.eq\("updated_at", abandonedUpdatedAt\)/,
    );
    assert.match(body, /await query\.select\("id"\)\.maybeSingle\(\);/);
    assert.match(body, /return data \? token : null;/);
  });

  it("releases a finished step only while the caller's token still holds the claim", () => {
    const body = functionBody("async function releaseImportChunkClaim(");
    assert.match(
      body,
      /\.update\(\{ processing_phase: null, updated_at: [^}]+\}\)\s*\.eq\("id", batchId\)\s*\.eq\("status", "review"\)\s*\.eq\("processing_phase", phase\)\s*\.eq\("updated_at", token\)\s*\.select\("id"\)\s*\.maybeSingle\(\);/,
    );
    assert.match(body, /return Boolean\(data\);/);
  });

  for (const [signature, phase, process] of [
    ["async function executeRunMaterializeCompaniesChunk(", "materializing_companies", "materializeCompaniesChunk("],
    ["async function executeRunMaterializeDraftLinksChunk(", "importing_to_draft", "materializeDraftLinksChunk("],
  ] as const) {
    it(`${phase} chunks process rows only with the claim, and complete only through its token`, () => {
      const body = functionBody(signature);
      const acquire = new RegExp(
        `await acquireImportChunkClaim\\(\\s*batchId,\\s*"${phase}",\\s*batch,\\s*options\\.claimToken \\?\\? null,?\\s*\\);`,
      );
      const acquireAt = body.search(acquire);
      assert.ok(acquireAt >= 0, "expected the chunk to acquire its claim with the presented token");
      const processAt = body.indexOf(process);
      assert.ok(acquireAt < processAt, `the claim must be acquired before ${process}`);
      assert.match(body, /if \(!claim\.acquired\) \{[\s\S]*?throw new SponsorImportHttpError\(/);
      const completeAt = body.search(
        new RegExp(
          `completeImportChunkWithDeps\\("${phase}", claim\\.token, chunk, \\(token\\) =>\\s*releaseImportChunkClaim\\(batchId, "${phase}", token\\),?\\s*\\)`,
        ),
      );
      assert.ok(completeAt > processAt, "the chunk must complete through the token-filtered release");
      assert.doesNotMatch(body, /\.update\(/, "no claim write outside the token-filtered helpers");
      assert.doesNotMatch(body, /\.is\("processing_phase", null\)/, "no claim outside acquireImportChunkClaim");
    });
  }
});

describe("import chunk writes never overwrite a later Review decision", () => {
  const read = (file: string) =>
    readFileSync(join(process.cwd(), "src/features/sponsor-import/server", file), "utf8");

  it("a company is written only to a resolved row that still has no company", () => {
    const body = read("materializeCompanies.ts");
    const persist = body.slice(body.indexOf("async function persistResolvedCompanyId("));
    assert.match(
      persist,
      /\.update\(\{ resolved_company_id: companyId, updated_at: [^}]+\}\)\s*\.eq\("id", rowId\)\s*\.eq\("status", "resolved"\)\s*\.is\("resolved_company_id", null\)\s*\.select\("id"\);/,
    );
    assert.match(persist, /return \(data \?\? \[\]\)\.length > 0;/);
  });

  it("a draft link is written only to a resolved, unlinked row still resolved to the link's company", () => {
    const body = read("materializeDraft.ts");
    const persist = body.slice(body.indexOf("async function persistRowDraftLinkIdIfUnchanged("));
    assert.match(
      persist,
      /\.update\(\{ draft_link_id: linkId, updated_at: [^}]+\}\)\s*\.eq\("id", rowId\)\s*\.eq\("status", "resolved"\)\s*\.is\("draft_link_id", null\)\s*\.eq\("resolved_company_id", companyId\)\s*\.select\("id"\);/,
    );
    assert.match(persist, /return \(data \?\? \[\]\)\.length > 0;/);
    assert.match(body, /persistRowDraftLinkId: \(rowId, linkId, companyId\) =>\s*persistRowDraftLinkIdIfUnchanged\(/);
    assert.match(body, /reconcileDraftLink: \(linkId\) => reconcileDraftLinkWithRows\(/);
  });

  it("finalisation checks every draft link against its rows before the batch becomes a draft", () => {
    const body = functionBody("async function executeImportBatchToDraft(");
    const checkAt = body.indexOf("await assertDraftLinksMatchRows(batchId);");
    assert.ok(checkAt >= 0, "expected the draft-link consistency check");
    assert.ok(checkAt < body.indexOf('status: "draft"'));
  });
});

describe("column mapping after draft links", () => {
  it("counts the batch's draft links before deleting rows", () => {
    const body = functionBody("export async function saveColumnMapping(");
    const count = body.slice(body.indexOf("countDraftLinks: async ()"), body.indexOf("downloadSourceFile:"));
    assert.match(
      count,
      /\.from\("sponsor_import_draft_links"\)\s*\.select\("id", \{ count: "exact", head: true \}\)\s*\.eq\("batch_id", batchId\);/,
    );
    const withDeps = functionBody("export async function saveColumnMappingWithDeps<");
    const checkAt = withDeps.indexOf("if ((await deps.countDraftLinks()) > 0)");
    assert.ok(checkAt >= 0, "expected the draft-link check");
    assert.ok(checkAt < withDeps.indexOf("deps.deleteRows("), "the check must precede the row delete");
  });
});

describe("row decisions never change rows with draft links", () => {
  it("reads draft_link_id and the restorable fields for the target row and its duplicate cluster", () => {
    const body = functionBody("export async function patchRowDecision(");
    assert.match(body, /\.select\("id, proposed_company_id, duplicate_cluster_key, normalized_domain, draft_link_id"\)/);
    assert.match(
      body,
      /\.select\(`id, duplicate_cluster_key, draft_link_id, \$\{DUPLICATE_SIBLING_PATCH_FIELDS\.join\(", "\)\}`\)/,
    );
  });

  it("every row write is conditional on the row still having no draft link", () => {
    const body = functionBody("export async function patchRowDecision(");
    const updates = body.match(/\.update\(patch\)[\s\S]*?;/g) ?? [];
    assert.equal((body.match(/\.update\(/g) ?? []).length, 3, "expected the row, sibling and restore writes only");
    assert.equal(updates.length, 2);
    for (const update of updates) {
      assert.match(update, /\.eq\("id", targetRowId\)\s*\.eq\("batch_id", batchId\)\s*\.is\("draft_link_id", null\)/);
    }
  });

  it("a sibling is restored only while it still holds the write being undone", () => {
    const body = functionBody("export async function patchRowDecision(");
    const restore = body.slice(body.indexOf("restoreSibling: async (targetRowId, previous, writtenAt)"));
    assert.match(
      restore,
      /\.update\(previous\)\s*\.eq\("id", targetRowId\)\s*\.eq\("batch_id", batchId\)\s*\.eq\("updated_at", writtenAt\)\s*\.is\("draft_link_id", null\)\s*\.select\("id"\);/,
    );
  });

  it("validation counts the batch's draft links", () => {
    const body = functionBody("export async function runBatchValidation(");
    const count = body.slice(body.indexOf("countDraftLinks: async ()"), body.indexOf("loadRows:"));
    assert.match(
      count,
      /\.from\("sponsor_import_draft_links"\)\s*\.select\("id", \{ count: "exact", head: true \}\)\s*\.eq\("batch_id", batchId\);/,
    );
  });
});

describe("matching claim token queries", () => {
  it("renews and releases only while the caller's token still holds the claim", () => {
    for (const dep of ["renewMatchingClaim: async (token)", "releaseMatchingClaim: async (token)"]) {
      const start = source.indexOf(dep);
      assert.ok(start >= 0, `Expected ${dep}`);
      const body = source.slice(start, source.indexOf("\n    },", start));
      assert.match(body, /\.eq\("processing_phase", "matching"\)\s*\.eq\("updated_at", token\)\s*\.select\("id"\)/);
    }
  });

  it("records the claim token on matching_run", () => {
    assert.match(
      source,
      /actionType: "matching_run",[\s\S]*?payload: \{ claim_token: claimToken, recovered_stale_claim: recoveredStaleClaim \}/,
    );
  });
});
