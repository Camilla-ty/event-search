/**
 * Fix known company logo storage anomalies (Phase 1 normalization).
 *
 * - CKMA: copy logo from wrong company UUID path to own company folder.
 * - NFT.NYC (company): copy logo from event-series path to company folder.
 *
 * Dry-run (default):
 *   npx tsx --env-file=.env.local scripts/fix-logo-storage-anomalies.ts
 *
 * Live:
 *   FIX_LIVE=1 npx tsx --env-file=.env.local scripts/fix-logo-storage-anomalies.ts
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import {
  COMPANY_LOGO_BUCKET,
  companyLogoObjectPath,
  parseCompanyLogoStoragePathFromUrl,
  verifyCompanyLogoStorageObject,
} from "@/src/features/companies/server/companyLogoStorage";
import { contentTypeForLogoExtension } from "@/src/features/companies/server/companyLogoMigration";
import { parseEventSeriesLogoStoragePathFromUrl } from "@/src/features/events/server/eventSeriesLogoStorage";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const CKMA_COMPANY_ID = "7abd1acf-5859-4c0c-81da-2ee24334bd41";
const NFT_NYC_COMPANY_ID = "1f230775-7707-4352-bf00-a4b6cd15a18b";

type FixPlan = {
  label: string;
  companyId: string;
  sourceStoragePath: string;
  targetStoragePath: string;
  extension: string;
};

type FixResult = {
  label: string;
  companyId: string;
  status: "dry_run" | "fixed" | "skipped" | "failed";
  beforeLogoUrl: string | null;
  afterLogoUrl: string | null;
  sourceStoragePath: string;
  targetStoragePath: string;
  error: string | null;
};

function parseBooleanEnv(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function buildPublicUrl(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  storagePath: string,
): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(storagePath);
  if (!publicUrl) {
    throw new Error(`public_url_failed:${storagePath}`);
  }
  return publicUrl;
}

function planCkmaFix(logoUrl: string | null): FixPlan | null {
  const parsed = parseCompanyLogoStoragePathFromUrl(logoUrl);
  if (!parsed) return null;

  const targetStoragePath = companyLogoObjectPath(CKMA_COMPANY_ID, parsed.extension);
  if (parsed.bucketRelativePath === targetStoragePath) return null;

  return {
    label: "CKMA",
    companyId: CKMA_COMPANY_ID,
    sourceStoragePath: parsed.bucketRelativePath,
    targetStoragePath,
    extension: parsed.extension,
  };
}

function planNftNycCompanyFix(logoUrl: string | null): FixPlan | null {
  const parsed = parseEventSeriesLogoStoragePathFromUrl(logoUrl);
  if (!parsed) return null;

  const targetStoragePath = companyLogoObjectPath(NFT_NYC_COMPANY_ID, parsed.extension);
  return {
    label: "NFT.NYC company",
    companyId: NFT_NYC_COMPANY_ID,
    sourceStoragePath: parsed.bucketRelativePath,
    targetStoragePath,
    extension: parsed.extension,
  };
}

async function copyStorageObject(params: {
  supabase: ReturnType<typeof createBackfillSupabaseClient>;
  plan: FixPlan;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, plan } = params;

  const { data: sourceObject, error: downloadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .download(plan.sourceStoragePath);

  if (downloadError || !sourceObject) {
    return { ok: false, error: downloadError?.message ?? "source_download_failed" };
  }

  const bytes = new Uint8Array(await sourceObject.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { ok: false, error: "source_object_empty" };
  }

  const contentType = contentTypeForLogoExtension(plan.extension);
  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(plan.targetStoragePath, bytes, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  return { ok: true };
}

async function loadCompany(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  companyId: string,
): Promise<{ id: string; name: string | null; logo_url: string | null }> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`companies query failed for ${companyId}: ${error.message}`);
  }
  if (!data || typeof data.id !== "string") {
    throw new Error(`company not found: ${companyId}`);
  }

  return {
    id: data.id,
    name: typeof data.name === "string" ? data.name : null,
    logo_url: typeof data.logo_url === "string" ? data.logo_url : null,
  };
}

async function applyFix(params: {
  supabase: ReturnType<typeof createBackfillSupabaseClient>;
  plan: FixPlan;
  beforeLogoUrl: string | null;
  live: boolean;
}): Promise<FixResult> {
  const { supabase, plan, beforeLogoUrl, live } = params;

  const sourceVerify = await verifyCompanyLogoStorageObject(plan.sourceStoragePath);
  if (!sourceVerify.ok) {
    return {
      label: plan.label,
      companyId: plan.companyId,
      status: "failed",
      beforeLogoUrl,
      afterLogoUrl: null,
      sourceStoragePath: plan.sourceStoragePath,
      targetStoragePath: plan.targetStoragePath,
      error: `source_missing:${sourceVerify.error}`,
    };
  }

  if (!live) {
    return {
      label: plan.label,
      companyId: plan.companyId,
      status: "dry_run",
      beforeLogoUrl,
      afterLogoUrl: buildPublicUrl(supabase, plan.targetStoragePath),
      sourceStoragePath: plan.sourceStoragePath,
      targetStoragePath: plan.targetStoragePath,
      error: null,
    };
  }

  const copied = await copyStorageObject({ supabase, plan });
  if (!copied.ok) {
    return {
      label: plan.label,
      companyId: plan.companyId,
      status: "failed",
      beforeLogoUrl,
      afterLogoUrl: null,
      sourceStoragePath: plan.sourceStoragePath,
      targetStoragePath: plan.targetStoragePath,
      error: copied.error,
    };
  }

  const targetVerify = await verifyCompanyLogoStorageObject(plan.targetStoragePath);
  if (!targetVerify.ok) {
    return {
      label: plan.label,
      companyId: plan.companyId,
      status: "failed",
      beforeLogoUrl,
      afterLogoUrl: null,
      sourceStoragePath: plan.sourceStoragePath,
      targetStoragePath: plan.targetStoragePath,
      error: `target_verify_failed:${targetVerify.error}`,
    };
  }

  const afterLogoUrl = buildPublicUrl(supabase, plan.targetStoragePath);
  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: afterLogoUrl })
    .eq("id", plan.companyId);

  if (updateError) {
    return {
      label: plan.label,
      companyId: plan.companyId,
      status: "failed",
      beforeLogoUrl,
      afterLogoUrl,
      sourceStoragePath: plan.sourceStoragePath,
      targetStoragePath: plan.targetStoragePath,
      error: `db_update_failed:${updateError.message}`,
    };
  }

  return {
    label: plan.label,
    companyId: plan.companyId,
    status: "fixed",
    beforeLogoUrl,
    afterLogoUrl,
    sourceStoragePath: plan.sourceStoragePath,
    targetStoragePath: plan.targetStoragePath,
    error: null,
  };
}

async function verifyCompanyRecord(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  companyId: string,
): Promise<{
  id: string;
  name: string | null;
  logo_url: string | null;
  storagePath: string | null;
  storageOk: boolean;
  pathMatchesCompanyId: boolean;
}> {
  const row = await loadCompany(supabase, companyId);
  const parsed = parseCompanyLogoStoragePathFromUrl(row.logo_url);
  const storagePath = parsed?.bucketRelativePath ?? null;
  const storageVerify = storagePath
    ? await verifyCompanyLogoStorageObject(storagePath)
    : { ok: false as const, error: "no_storage_path" };

  return {
    id: row.id,
    name: row.name,
    logo_url: row.logo_url,
    storagePath,
    storageOk: storageVerify.ok,
    pathMatchesCompanyId: parsed?.companyId === companyId,
  };
}

async function main() {
  const live = parseBooleanEnv(process.env.FIX_LIVE);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath =
    process.env.FIX_REPORT_PATH?.trim() ||
    path.join("reports", `fix-logo-storage-anomalies-${timestamp}.jsonl`);

  const supabase = createBackfillSupabaseClient();
  const [ckmaRow, nftRow] = await Promise.all([
    loadCompany(supabase, CKMA_COMPANY_ID),
    loadCompany(supabase, NFT_NYC_COMPANY_ID),
  ]);

  const plans: FixPlan[] = [];
  const ckmaPlan = planCkmaFix(ckmaRow.logo_url);
  if (ckmaPlan) plans.push(ckmaPlan);
  const nftPlan = planNftNycCompanyFix(nftRow.logo_url);
  if (nftPlan) plans.push(nftPlan);

  console.log("[fix-logo-storage-anomalies] starting", { live, plans: plans.length });

  await mkdir(path.dirname(reportPath), { recursive: true });

  const results: FixResult[] = [];
  for (const plan of plans) {
    const beforeLogoUrl =
      plan.companyId === CKMA_COMPANY_ID ? ckmaRow.logo_url : nftRow.logo_url;
    const result = await applyFix({ supabase, plan, beforeLogoUrl, live });
    results.push(result);
    await appendFile(reportPath, `${JSON.stringify(result)}\n`, "utf8");
    console.log(result);
  }

  if (live && results.some((result) => result.status === "fixed")) {
    const verification = await Promise.all([
      verifyCompanyRecord(supabase, CKMA_COMPANY_ID),
      verifyCompanyRecord(supabase, NFT_NYC_COMPANY_ID),
    ]);
    console.log("[fix-logo-storage-anomalies] verification", verification);
    await appendFile(
      reportPath,
      `${JSON.stringify({ type: "verification", records: verification })}\n`,
      "utf8",
    );
  }

  console.log("[fix-logo-storage-anomalies] report:", reportPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[fix-logo-storage-anomalies] fatal:", message);
  process.exit(1);
});
