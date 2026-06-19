/**
 * One-off QA script for company logo upload server flow.
 * Does not delete legacy domain folders.
 */
import { uploadCompanyLogoFileAdmin } from "@/src/features/companies/server/companyAdmin";
import {
  COMPANY_LOGO_BUCKET,
  parseCompanyLogoStoragePathFromUrl,
  selectStaleCompanyLogoCleanupPaths,
} from "@/src/features/companies/server/companyLogoStorage";
import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";

import { createBackfillSupabaseClient } from "../scripts/backfill/core/supabase";

const MINIMAL_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const MINIMAL_WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00,
  0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe, 0xfb, 0xfd, 0x50, 0x00,
]);

type QaResult = {
  check: string;
  pass: boolean;
  detail: string;
};

const results: QaResult[] = [];

function record(check: string, pass: boolean, detail: string) {
  results.push({ check, pass, detail });
}

async function listCompanyFolderObjects(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
  companyId: string,
): Promise<string[]> {
  const prefix = `companies/${companyId}`;
  const { data, error } = await supabase.storage.from(COMPANY_LOGO_BUCKET).list(prefix);
  if (error || !data) return [];
  return data
    .map((item) => (typeof item.name === "string" ? `${prefix}/${item.name}` : null))
    .filter((value): value is string => value !== null);
}

async function main() {
  const supabase = createBackfillSupabaseClient();

  const svg = validateCompanyLogoUpload({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/svg+xml",
  });
  record(
    "Reject SVG MIME",
    !svg.ok && svg.code === "unsupported_type",
    svg.ok ? "unexpected pass" : svg.message,
  );

  const oversize = validateCompanyLogoUpload({
    bytes: new Uint8Array(2 * 1024 * 1024 + 1),
    mimeType: "image/png",
  });
  record(
    "Reject oversize file",
    !oversize.ok && oversize.code === "file_too_large",
    oversize.ok ? "unexpected pass" : oversize.message,
  );

  const empty = validateCompanyLogoUpload({
    bytes: new Uint8Array(),
    mimeType: "image/png",
  });
  record(
    "Reject empty file",
    !empty.ok && empty.code === "empty_file",
    empty.ok ? "unexpected pass" : empty.message,
  );

  for (const mimeType of ["image/png", "image/jpeg", "image/webp"] as const) {
    const valid = validateCompanyLogoUpload({
      bytes: MINIMAL_PNG,
      mimeType,
    });
    record(`Accept ${mimeType}`, valid.ok, valid.ok ? valid.extension : valid.message);
  }

  const stale = selectStaleCompanyLogoCleanupPaths({
    companyId: "550e8400-e29b-41d4-a716-446655440000",
    activeStoragePath: "companies/550e8400-e29b-41d4-a716-446655440000/logo.webp",
  });
  record(
    "Cleanup candidates exclude active webp and include png",
    stale.includes(
      "companies/550e8400-e29b-41d4-a716-446655440000/logo.png",
    ) && !stale.includes("companies/550e8400-e29b-41d4-a716-446655440000/logo.webp"),
    stale.join(", "),
  );

  const legacyStale = selectStaleCompanyLogoCleanupPaths({
    companyId: "550e8400-e29b-41d4-a716-446655440000",
    activeStoragePath: "companies/acme.com/logo.png",
  });
  record(
    "Cleanup skips legacy domain paths",
    legacyStale.length === 0,
    `count=${legacyStale.length}`,
  );

  const { data: companyRow } = await supabase
    .from("companies")
    .select("id, name, logo_url, logo_source, logo_status, logo_fetch_error, logo_fetched_at")
    .not("logo_url", "is", null)
    .limit(1)
    .maybeSingle();

  if (!companyRow || typeof companyRow.id !== "string") {
    record("Live upload integration", false, "No company row available for integration test");
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  const companyId = companyRow.id;
  const beforeLogoUrl = typeof companyRow.logo_url === "string" ? companyRow.logo_url : null;
  const legacyPathBefore =
    beforeLogoUrl !== null
      ? parseCompanyLogoStoragePathFromUrl(beforeLogoUrl)?.bucketRelativePath ?? null
      : null;

  const pngUpload = await uploadCompanyLogoFileAdmin(companyId, {
    bytes: MINIMAL_PNG,
    mimeType: "image/png",
  });
  record(
    "Live PNG upload",
    pngUpload.ok,
    pngUpload.ok ? pngUpload.company.logo_url ?? "" : pngUpload.error,
  );

  if (pngUpload.ok) {
    const parsed = parseCompanyLogoStoragePathFromUrl(pngUpload.company.logo_url);
    record(
      "PNG stored at companyId path",
      parsed?.bucketRelativePath === `companies/${companyId}/logo.png`,
      parsed?.bucketRelativePath ?? "unparsed",
    );
    record(
      "DB metadata after PNG upload",
      pngUpload.company.logo_source === "manual" &&
        pngUpload.company.logo_status === "ok" &&
        pngUpload.company.logo_fetch_error === null &&
        pngUpload.company.logo_fetched_at !== null,
      JSON.stringify({
        logo_source: pngUpload.company.logo_source,
        logo_status: pngUpload.company.logo_status,
        logo_fetch_error: pngUpload.company.logo_fetch_error,
        logo_fetched_at: pngUpload.company.logo_fetched_at,
      }),
    );

    const objectsAfterPng = await listCompanyFolderObjects(supabase, companyId);
    record(
      "companyId folder contains logo.png after PNG upload",
      objectsAfterPng.includes(`companies/${companyId}/logo.png`),
      objectsAfterPng.join(", "),
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const webpUpload = await uploadCompanyLogoFileAdmin(companyId, {
      bytes: MINIMAL_WEBP,
      mimeType: "image/webp",
    });
    record(
      "Live WebP upload after PNG",
      webpUpload.ok,
      webpUpload.ok ? webpUpload.company.logo_url ?? "" : webpUpload.error,
    );

    if (webpUpload.ok) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const objectsAfterWebp = await listCompanyFolderObjects(supabase, companyId);
      const hasWebp = objectsAfterWebp.includes(`companies/${companyId}/logo.webp`);
      const hasPng = objectsAfterWebp.includes(`companies/${companyId}/logo.png`);
      record(
        "Cleanup keeps only active webp in companyId folder",
        hasWebp && !hasPng,
        objectsAfterWebp.join(", "),
      );
    }

    if (
      legacyPathBefore &&
      parseCompanyLogoStoragePathFromUrl(beforeLogoUrl)?.isLegacyPath
    ) {
      const { data: legacyBlob } = await supabase.storage
        .from(COMPANY_LOGO_BUCKET)
        .download(legacyPathBefore);
      record(
        "Legacy domain object not deleted",
        (legacyBlob?.size ?? 0) > 0,
        legacyPathBefore,
      );
    }
  }

  const failed = results.filter((item) => !item.pass);
  console.log(JSON.stringify({ summary: { total: results.length, failed: failed.length }, results }, null, 2));
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
