import { createAdminClient } from "@/src/lib/supabase/admin";

const PROGRAM_ID = "26c56d83-cd31-4a7a-b372-98dcdf041840";
const VERSION_ID = "7fd89aa6-8a0f-44dd-9b93-e46100bbbb62";
const CATALOG_IDS = [
  "911c2d26-6942-483b-9dc1-c47cf13f91fa",
  "f024e025-a14d-4acf-8773-92d955fd534a",
  "560b1ee0-2435-4184-83cc-283d078d504e",
  "c2b62910-1a59-42b0-a8ff-249247ad0ffd",
];

type Counts = {
  current_version_id: string | null;
  version_members: number;
  version_exists: number;
  bogus_companies: number;
  catalog_sanity: number;
};

async function getCounts(supabase: ReturnType<typeof createAdminClient>): Promise<Counts> {
  const { data: program, error: programError } = await supabase
    .from("event_partner_alumni")
    .select("current_version_id")
    .eq("id", PROGRAM_ID)
    .single();
  if (programError) throw new Error(programError.message);

  const { count: versionMembers, error: membersError } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("*", { count: "exact", head: true })
    .eq("event_partner_alumni_version_id", VERSION_ID);
  if (membersError) throw new Error(membersError.message);

  const { count: versionExists, error: versionError } = await supabase
    .from("event_partner_alumni_versions")
    .select("*", { count: "exact", head: true })
    .eq("id", VERSION_ID);
  if (versionError) throw new Error(versionError.message);

  const { data: bogusRows, error: bogusError } = await supabase
    .from("companies")
    .select("id")
    .gte("created_at", "2026-07-05")
    .lt("created_at", "2026-07-06")
    .filter("name", "match", "^[0-9]+$");
  if (bogusError) throw new Error(bogusError.message);

  const { data: catalogRows, error: catalogError } = await supabase
    .from("companies")
    .select("id")
    .in("id", CATALOG_IDS);
  if (catalogError) throw new Error(catalogError.message);

  return {
    current_version_id: program.current_version_id as string | null,
    version_members: versionMembers ?? 0,
    version_exists: versionExists ?? 0,
    bogus_companies: bogusRows?.length ?? 0,
    catalog_sanity: catalogRows?.length ?? 0,
  };
}

async function countBogusBlockers(
  supabase: ReturnType<typeof createAdminClient>,
  bogusIds: string[],
): Promise<number> {
  if (bogusIds.length === 0) return 0;

  const chunkSize = 100;
  let total = 0;

  for (let offset = 0; offset < bogusIds.length; offset += chunkSize) {
    const chunk = bogusIds.slice(offset, offset + chunkSize);
    const checks = await Promise.all([
      supabase.from("event_sponsors").select("id", { count: "exact", head: true }).in("company_id", chunk),
      supabase
        .from("event_edition_organizers")
        .select("id", { count: "exact", head: true })
        .in("company_id", chunk),
      supabase
        .from("event_partner_alumni_version_companies")
        .select("id", { count: "exact", head: true })
        .in("company_id", chunk),
      supabase.from("company_domains").select("id", { count: "exact", head: true }).in("company_id", chunk),
      supabase
        .from("sponsor_import_draft_links")
        .select("id", { count: "exact", head: true })
        .in("company_id", chunk),
    ]);

    for (const result of checks) {
      if (result.error) throw new Error(result.error.message);
      total += result.count ?? 0;
    }
  }

  return total;
}

function printCounts(label: string, counts: Counts) {
  console.log(JSON.stringify({ step: label, ...counts }, null, 2));
}

async function main() {
  const supabase = createAdminClient();

  printCounts("before", await getCounts(supabase));

  const { error: step1Error } = await supabase
    .from("event_partner_alumni")
    .update({ current_version_id: null, updated_at: new Date().toISOString() })
    .eq("id", PROGRAM_ID)
    .eq("current_version_id", VERSION_ID);
  if (step1Error) throw new Error(`Step 1 failed: ${step1Error.message}`);
  printCounts("after step 1 unset current_version_id", await getCounts(supabase));

  const { error: step2Error, count: deletedMembers } = await supabase
    .from("event_partner_alumni_version_companies")
    .delete({ count: "exact" })
    .eq("event_partner_alumni_version_id", VERSION_ID);
  if (step2Error) throw new Error(`Step 2 failed: ${step2Error.message}`);
  console.log(JSON.stringify({ step: "step 2 deleted version members", deleted: deletedMembers ?? 0 }));
  printCounts("after step 2 delete version members", await getCounts(supabase));

  const { error: step3Error, count: deletedVersions } = await supabase
    .from("event_partner_alumni_versions")
    .delete({ count: "exact" })
    .eq("id", VERSION_ID)
    .eq("event_partner_alumni_id", PROGRAM_ID);
  if (step3Error) throw new Error(`Step 3 failed: ${step3Error.message}`);
  console.log(JSON.stringify({ step: "step 3 deleted version", deleted: deletedVersions ?? 0 }));
  printCounts("after step 3 delete corrupt version", await getCounts(supabase));

  const { data: bogusRows, error: bogusFetchError } = await supabase
    .from("companies")
    .select("id")
    .gte("created_at", "2026-07-05")
    .lt("created_at", "2026-07-06")
    .filter("name", "match", "^[0-9]+$");
  if (bogusFetchError) throw new Error(bogusFetchError.message);

  const bogusIds = (bogusRows ?? []).map((row) => String(row.id));
  const blockers = await countBogusBlockers(supabase, bogusIds);
  console.log(JSON.stringify({ step: "step 4 blocker guard", bogus_ids: bogusIds.length, blockers }));
  if (blockers > 0) {
    throw new Error(`Step 4 blocked: ${blockers} references remain on bogus companies`);
  }

  const { error: step5Error, count: deletedCompanies } = await supabase
    .from("companies")
    .delete({ count: "exact" })
    .gte("created_at", "2026-07-05")
    .lt("created_at", "2026-07-06")
    .filter("name", "match", "^[0-9]+$");
  if (step5Error) throw new Error(`Step 5 failed: ${step5Error.message}`);
  console.log(JSON.stringify({ step: "step 5 deleted bogus companies", deleted: deletedCompanies ?? 0 }));
  printCounts("after step 5 delete bogus companies", await getCounts(supabase));

  const { data: catalogCheck, error: catalogCheckError } = await supabase
    .from("companies")
    .select("id, name, domain, created_at")
    .in("id", CATALOG_IDS)
    .order("name");
  if (catalogCheckError) throw new Error(catalogCheckError.message);
  console.log(JSON.stringify({ step: "catalog sanity", companies: catalogCheck }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
