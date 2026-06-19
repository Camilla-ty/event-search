import {
  contentTypeForLogoExtension,
  planCompanyLogoMigration,
  type CompanyLogoMigrationRow,
} from "@/src/features/companies/server/companyLogoMigration";
import {
  COMPANY_LOGO_BUCKET,
  parseCompanyLogoStoragePathFromUrl,
} from "@/src/features/companies/server/companyLogoStorage";

import { createBackfillSupabaseClient } from "../scripts/backfill/core/supabase";

const TARGET_IDS = [
  "67a56c88-c3f1-4a66-85f9-b96dfd665fff",
  "7cbea8af-9db0-47e2-9123-d5350659e81a",
] as const;

type CompanyStatus = {
  companyId: string;
  companyName: string | null;
  logoUrl: string | null;
  logoUrlIsLegacy: boolean;
  newStoragePath: string | null;
  newObjectExists: boolean;
  newObjectBytes: number | null;
  action: string;
  result: string;
};

function buildPublicUrl(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  storagePath: string,
): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

async function checkNewObject(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  storagePath: string,
): Promise<{ exists: boolean; bytes: number | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).download(storagePath);
  if (error || !data) {
    return { exists: false, bytes: null, error: error?.message ?? "download_failed" };
  }
  return { exists: data.size > 0, bytes: data.size, error: null };
}

async function retryMigration(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  plan: {
    companyId: string;
    oldStoragePath: string;
    newStoragePath: string;
    newPublicUrl: string;
    extension: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: oldObject, error: downloadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .download(plan.oldStoragePath);

  if (downloadError || !oldObject) {
    return { ok: false, error: downloadError?.message ?? "legacy_download_failed" };
  }

  const bytes = new Uint8Array(await oldObject.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { ok: false, error: "legacy_object_empty" };
  }

  const contentType = contentTypeForLogoExtension(plan.extension);
  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(plan.newStoragePath, bytes, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const verified = await checkNewObject(supabase, plan.newStoragePath);
  if (!verified.exists) {
    return {
      ok: false,
      error: verified.error ?? "new_object_verification_failed",
    };
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: plan.newPublicUrl })
    .eq("id", plan.companyId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}

async function main() {
  const supabase = createBackfillSupabaseClient();
  const results: CompanyStatus[] = [];

  for (const companyId of TARGET_IDS) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !data) {
      results.push({
        companyId,
        companyName: null,
        logoUrl: null,
        logoUrlIsLegacy: false,
        newStoragePath: null,
        newObjectExists: false,
        newObjectBytes: null,
        action: "inspect",
        result: error?.message ?? "company_not_found",
      });
      continue;
    }

    const row: CompanyLogoMigrationRow = {
      id: data.id,
      name: typeof data.name === "string" ? data.name : null,
      logo_url: typeof data.logo_url === "string" ? data.logo_url : null,
    };

    const planResult = planCompanyLogoMigration(row, (path) => buildPublicUrl(supabase, path));
    const parsed = parseCompanyLogoStoragePathFromUrl(row.logo_url);
    const logoUrlIsLegacy = parsed?.isLegacyPath === true;

    if (planResult.kind === "skip" && planResult.reason === "already_company_id_path") {
      results.push({
        companyId: row.id,
        companyName: row.name,
        logoUrl: row.logo_url,
        logoUrlIsLegacy: false,
        newStoragePath: parsed?.bucketRelativePath ?? null,
        newObjectExists: true,
        newObjectBytes: null,
        action: "none",
        result: "already_migrated",
      });
      continue;
    }

    if (planResult.kind !== "plan") {
      results.push({
        companyId: row.id,
        companyName: row.name,
        logoUrl: row.logo_url,
        logoUrlIsLegacy,
        newStoragePath: null,
        newObjectExists: false,
        newObjectBytes: null,
        action: "inspect",
        result: `cannot_plan:${planResult.reason}`,
      });
      continue;
    }

    const { plan } = planResult;
    const newCheck = await checkNewObject(supabase, plan.newStoragePath);

    if (newCheck.exists) {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: plan.newPublicUrl })
        .eq("id", plan.companyId);

      results.push({
        companyId: row.id,
        companyName: row.name,
        logoUrl: row.logo_url,
        logoUrlIsLegacy,
        newStoragePath: plan.newStoragePath,
        newObjectExists: true,
        newObjectBytes: newCheck.bytes,
        action: "update_logo_url_only",
        result: updateError ? `db_update_failed:${updateError.message}` : "ok",
      });
      continue;
    }

    const retry = await retryMigration(supabase, plan);
    const after = await checkNewObject(supabase, plan.newStoragePath);
    const { data: afterRow } = await supabase
      .from("companies")
      .select("logo_url")
      .eq("id", plan.companyId)
      .maybeSingle();

    results.push({
      companyId: row.id,
      companyName: row.name,
      logoUrl: typeof afterRow?.logo_url === "string" ? afterRow.logo_url : row.logo_url,
      logoUrlIsLegacy,
      newStoragePath: plan.newStoragePath,
      newObjectExists: after.exists,
      newObjectBytes: after.bytes,
      action: "retry_migration",
      result: retry.ok ? "ok" : retry.error,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
