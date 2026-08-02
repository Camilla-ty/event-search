import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(__dirname, "../../..");

describe("DB-001 exhibitor_import_publish_batch execute grants", () => {
  it("migration restricts EXECUTE via the shared service_role helper", () => {
    const sql = readFileSync(
      path.join(
        ROOT,
        "supabase/migrations/20260802170000_restrict_exhibitor_import_publish_batch_execute.sql",
      ),
      "utf8",
    );

    assert.match(
      sql,
      /__restrict_rpc_execute_to_service_role\(\s*'public\.exhibitor_import_publish_batch\(uuid, uuid\)'/,
    );
    assert.doesNotMatch(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC;\s*$/m);
  });

  it("verify SQL asserts anon/authenticated denied and service_role allowed", () => {
    const sql = readFileSync(
      path.join(
        ROOT,
        "supabase/verify/exhibitor_import_publish_batch_execute_grants.sql",
      ),
      "utf8",
    );

    assert.match(sql, /exhibitor_import_publish_batch/);
    assert.match(sql, /has_function_privilege\('anon'/);
    assert.match(sql, /has_function_privilege\('authenticated'/);
    assert.match(sql, /has_function_privilege\('service_role'/);
    assert.match(sql, /anon EXECUTE = false/);
    assert.match(sql, /authenticated EXECUTE = false/);
    assert.match(sql, /service_role EXECUTE = true/);
  });

  it("admin publish path still uses createAdminClient for the RPC", () => {
    const source = readFileSync(
      path.join(
        ROOT,
        "src/features/exhibitor-import/server/exhibitorImportAdmin.ts",
      ),
      "utf8",
    );
    const publishSlice = source.slice(
      source.indexOf("export async function publishBatch"),
      source.indexOf("export async function", source.indexOf("export async function publishBatch") + 1),
    );

    assert.match(publishSlice, /createAdminClient\(\)/);
    assert.match(publishSlice, /\.rpc\(\s*"exhibitor_import_publish_batch"/);
  });
});
