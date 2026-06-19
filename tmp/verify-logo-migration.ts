import { createBackfillSupabaseClient } from "../scripts/backfill/core/supabase";
import {
  COMPANY_LOGO_BUCKET,
  parseCompanyLogoStoragePathFromUrl,
} from "@/src/features/companies/server/companyLogoStorage";

const ids = [
  "67a56c88-c3f1-4a66-85f9-b96dfd665fff",
  "7cbea8af-9db0-47e2-9123-d5350659e81a",
];

async function main() {
  const supabase = createBackfillSupabaseClient();
  for (const id of ids) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .eq("id", id)
      .maybeSingle();

    const parsed = parseCompanyLogoStoragePathFromUrl(
      typeof data?.logo_url === "string" ? data.logo_url : null,
    );
    const newPath = `companies/${id}/logo.png`;
    const { data: blob, error } = await supabase.storage
      .from(COMPANY_LOGO_BUCKET)
      .download(newPath);

    console.log(
      JSON.stringify({
        name: data?.name ?? null,
        id,
        logo_url: data?.logo_url ?? null,
        pathIsCompanyId: parsed !== null && !parsed.isLegacyPath,
        parsedPath: parsed?.bucketRelativePath ?? null,
        newObjectBytes: blob?.size ?? null,
        newObjectError: error?.message ?? null,
      }),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
